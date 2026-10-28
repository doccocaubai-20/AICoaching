-- ==============================================================================
-- CALISCOACHING - MIGRATION 20261028000001
-- D5: Nhóm nhỏ cùng giữ cam kết (Accountability Groups 3-5 người quen)
-- 
-- TUÂN THỦ NGUYÊN TẮC BẢO MẬT & QUYỀN RIÊNG TƯ:
-- 1. Giới hạn nhóm từ 1 đến 5 thành viên (atomic capacity check).
-- 2. Phân quyền: owner, admin, member (Contract G0).
-- 3. Owner rời nhóm bắt buộc chuyển quyền hoặc giải tán/archive nhóm.
-- 4. Lời mời bảo mật: lưu token_hash (SHA-256), TTL, revoke, max_uses.
-- 5. Preview lời mời là GET an toàn, không tự gia nhập, không lộ cam kết/dữ liệu riêng.
-- 6. RLS tránh đệ quy qua hàm SECURITY DEFINER (is_active_group_member).
-- 7. Chống tự nâng role, chống kick owner, chống replay token.
-- 8. Cam kết tuần độc lập, không bảng xếp hạng, không truy cập hồ sơ y tế/nhật ký riêng.
-- 9. Khi rời nhóm, thành viên mất quyền truy cập tức thì; cam kết chi tiết được ẩn khỏi nhóm.
-- 10. Hẹn buổi chung có lưu revision khi sửa lịch, yêu cầu người tham gia xác nhận lại.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG GROUPS (Nhóm cam kết)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 60),
    description TEXT CHECK (description IS NULL OR char_length(description) <= 300),
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. BẢNG GROUP_MEMBERS (Thành viên nhóm)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
    is_muted BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    CONSTRAINT uq_group_member_user UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_members_group_status ON public.group_members(group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_members_user_status ON public.group_members(user_id, status);

-- ------------------------------------------------------------------------------
-- 3. CÁC HÀM BẢO MẬT SECURITY DEFINER ĐỂ TRÁNH ĐỆ QUY TRONG RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_group_member_role(p_group_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.group_members
  WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
$$;

-- RLS Policies cho GROUPS
CREATE POLICY "groups_select_active_members" ON public.groups
    FOR SELECT TO authenticated
    USING (public.is_active_group_member(id, auth.uid()));

CREATE POLICY "groups_insert_creator" ON public.groups
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_owner_or_admin" ON public.groups
    FOR UPDATE TO authenticated
    USING (public.get_group_member_role(id, auth.uid()) IN ('owner', 'admin'))
    WITH CHECK (public.get_group_member_role(id, auth.uid()) IN ('owner', 'admin'));

-- RLS Policies cho GROUP_MEMBERS
CREATE POLICY "group_members_select_active_peers" ON public.group_members
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid() OR
      public.is_active_group_member(group_id, auth.uid())
    );

CREATE POLICY "group_members_update_self_mute" ON public.group_members
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. RÀNG BUỘC SỨC CHỨA TỐI ĐA 5 THÀNH VIÊN VÀ CHỐNG TỰ NÂNG ROLE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_group_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.group_members
    WHERE group_id = NEW.group_id
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Nhóm đã đạt số lượng tối đa 5 thành viên' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_group_capacity ON public.group_members;
CREATE TRIGGER trg_check_group_capacity
BEFORE INSERT OR UPDATE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.check_group_capacity();

CREATE OR REPLACE FUNCTION public.check_role_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Nếu role bị thay đổi
  IF TG_OP = 'UPDATE' AND NEW.role != OLD.role THEN
    -- Thành viên thường không được tự nâng role của mình
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND OLD.role = 'member' AND NEW.role IN ('admin', 'owner') THEN
      RAISE EXCEPTION 'Thành viên không được phép tự nâng quyền' USING ERRCODE = '42501';
    END IF;
    -- Non-owner không được phép thay đổi role của owner
    IF auth.uid() IS NOT NULL AND OLD.role = 'owner' AND public.get_group_member_role(OLD.group_id, auth.uid()) != 'owner' THEN
      RAISE EXCEPTION 'Chỉ chủ nhóm mới có thể chuyển giao hoặc thay đổi quyền chủ nhóm' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_role_integrity ON public.group_members;
CREATE TRIGGER trg_check_role_integrity
BEFORE UPDATE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.check_role_integrity();

-- ------------------------------------------------------------------------------
-- 5. BẢNG GROUP_INVITES (Lời mời gia nhập)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses >= 1 AND max_uses <= 10),
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0 AND used_count <= max_uses),
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_invites_select_admin" ON public.group_invites
    FOR SELECT TO authenticated
    USING (public.get_group_member_role(group_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "group_invites_insert_admin" ON public.group_invites
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = created_by AND
      public.get_group_member_role(group_id, auth.uid()) IN ('owner', 'admin')
    );

CREATE POLICY "group_invites_update_admin" ON public.group_invites
    FOR UPDATE TO authenticated
    USING (public.get_group_member_role(group_id, auth.uid()) IN ('owner', 'admin'))
    WITH CHECK (public.get_group_member_role(group_id, auth.uid()) IN ('owner', 'admin'));

-- ------------------------------------------------------------------------------
-- 6. BẢNG GROUP_COMMITMENTS (Cam kết tuần của từng thành viên)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 3 AND char_length(content) <= 500),
    target_count INTEGER CHECK (target_count IS NULL OR (target_count >= 1 AND target_count <= 50)),
    completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0 AND (target_count IS NULL OR completed_count <= 50)),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'rescheduled', 'needs_companion')),
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_group_user_week UNIQUE (group_id, user_id, week_start)
);

ALTER TABLE public.group_commitments ENABLE ROW LEVEL SECURITY;

-- Chính sách: Thành viên active xem cam kết của các thành viên CÒN HOẠT ĐỘNG trong nhóm.
-- Thành viên đã rời nhóm bị ẩn chi tiết cam kết để bảo vệ quyền riêng tư.
CREATE POLICY "group_commitments_select_active" ON public.group_commitments
    FOR SELECT TO authenticated
    USING (
      public.is_active_group_member(group_id, auth.uid()) AND
      public.is_active_group_member(group_id, user_id)
    );

CREATE POLICY "group_commitments_insert_own" ON public.group_commitments
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_group_member(group_id, auth.uid())
    );

CREATE POLICY "group_commitments_update_own" ON public.group_commitments
    FOR UPDATE TO authenticated
    USING (
      auth.uid() = user_id AND
      public.is_active_group_member(group_id, auth.uid())
    )
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_group_member(group_id, auth.uid())
    );

CREATE POLICY "group_commitments_delete_own" ON public.group_commitments
    FOR DELETE TO authenticated
    USING (
      auth.uid() = user_id AND
      public.is_active_group_member(group_id, auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 7. BẢNG PHẢN HỒI: GROUP_REACTIONS VÀ GROUP_FEEDBACK_MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES public.group_commitments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('clap', 'fire', 'muscle', 'heart')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_group_reaction UNIQUE (commitment_id, user_id, reaction_type)
);

ALTER TABLE public.group_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_member_of_commitment(p_commitment_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_commitments c
    WHERE c.id = p_commitment_id
      AND public.is_active_group_member(c.group_id, p_user_id)
  );
$$;

CREATE POLICY "group_reactions_select" ON public.group_reactions
    FOR SELECT TO authenticated
    USING (public.is_active_member_of_commitment(commitment_id, auth.uid()));

CREATE POLICY "group_reactions_insert" ON public.group_reactions
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_member_of_commitment(commitment_id, auth.uid())
    );

CREATE POLICY "group_reactions_delete" ON public.group_reactions
    FOR DELETE TO authenticated
    USING (
      auth.uid() = user_id AND
      public.is_active_member_of_commitment(commitment_id, auth.uid())
    );

CREATE TABLE IF NOT EXISTS public.group_feedback_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES public.group_commitments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(trim(message)) >= 1 AND char_length(message) <= 280),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_feedback_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_feedback_messages_select" ON public.group_feedback_messages
    FOR SELECT TO authenticated
    USING (public.is_active_member_of_commitment(commitment_id, auth.uid()));

CREATE POLICY "group_feedback_messages_insert" ON public.group_feedback_messages
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_member_of_commitment(commitment_id, auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 8. BẢNG GROUP_MEETUPS VÀ GROUP_MEETUP_RSVPS (Hẹn buổi chung & Revision)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3 AND char_length(title) <= 100),
    scheduled_at TIMESTAMPTZ NOT NULL,
    location TEXT CHECK (location IS NULL OR char_length(location) <= 200),
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    revision_note TEXT CHECK (revision_note IS NULL OR char_length(revision_note) <= 200),
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_meetups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_meetups_select" ON public.group_meetups
    FOR SELECT TO authenticated
    USING (public.is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_meetups_insert" ON public.group_meetups
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = created_by AND
      public.is_active_group_member(group_id, auth.uid())
    );

CREATE POLICY "group_meetups_update" ON public.group_meetups
    FOR UPDATE TO authenticated
    USING (public.is_active_group_member(group_id, auth.uid()))
    WITH CHECK (public.is_active_group_member(group_id, auth.uid()));

CREATE POLICY "group_meetups_delete" ON public.group_meetups
    FOR DELETE TO authenticated
    USING (
      public.is_active_group_member(group_id, auth.uid()) AND
      (auth.uid() = created_by OR public.get_group_member_role(group_id, auth.uid()) IN ('owner', 'admin'))
    );

CREATE TABLE IF NOT EXISTS public.group_meetup_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id UUID NOT NULL REFERENCES public.group_meetups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'declined')),
    acknowledged_revision INTEGER NOT NULL DEFAULT 1 CHECK (acknowledged_revision >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_meetup_rsvp UNIQUE (meetup_id, user_id)
);

ALTER TABLE public.group_meetup_rsvps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_member_of_meetup(p_meetup_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_meetups m
    WHERE m.id = p_meetup_id
      AND public.is_active_group_member(m.group_id, p_user_id)
  );
$$;

CREATE POLICY "group_meetup_rsvps_select" ON public.group_meetup_rsvps
    FOR SELECT TO authenticated
    USING (public.is_active_member_of_meetup(meetup_id, auth.uid()));

CREATE POLICY "group_meetup_rsvps_insert" ON public.group_meetup_rsvps
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_member_of_meetup(meetup_id, auth.uid())
    );

CREATE POLICY "group_meetup_rsvps_update" ON public.group_meetup_rsvps
    FOR UPDATE TO authenticated
    USING (
      auth.uid() = user_id AND
      public.is_active_member_of_meetup(meetup_id, auth.uid())
    )
    WITH CHECK (
      auth.uid() = user_id AND
      public.is_active_member_of_meetup(meetup_id, auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 9. BẢNG RATE LIMIT ĐỂ BẢO VỆ NHIỀU INSTANCE (KHÔNG DÙNG RAM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_rate_limits_user_action ON public.group_rate_limits(user_id, action_type, created_at);

CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
    p_user_id UUID,
    p_action TEXT,
    p_max_attempts INT,
    p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.group_rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action
    AND created_at >= NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_count >= p_max_attempts THEN
    RAISE EXCEPTION 'Vượt quá tần suất cho phép đối với thao tác này. Vui lòng thử lại sau.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.group_rate_limits (user_id, action_type, created_at)
  VALUES (p_user_id, p_action, now());

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. RPC: TẠO NHÓM VÀ TỰ ĐỘNG THÊM OWNER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_with_owner(
    p_name TEXT,
    p_description TEXT,
    p_timezone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_group_id UUID;
  v_tz TEXT := COALESCE(NULLIF(trim(p_timezone), ''), 'Asia/Ho_Chi_Minh');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  -- Rate limit: 5 lần tạo nhóm / 1 giờ
  PERFORM public.check_and_record_rate_limit(v_user_id, 'create_group', 50, 3600);

  INSERT INTO public.groups (name, description, timezone, created_by, status)
  VALUES (trim(p_name), NULLIF(trim(p_description), ''), v_tz, v_user_id, 'active')
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_user_id, 'owner', 'active');

  RETURN v_group_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. RPC: TẠO LỜI MỜI NHÓM
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_invite(
    p_group_id UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_max_uses INT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_invite_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_group_member_role(p_group_id, v_user_id);
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm hoặc quản trị viên mới có quyền tạo lời mời' USING ERRCODE = '42501';
  END IF;

  -- Rate limit: 10 lần tạo invite / 1 giờ
  PERFORM public.check_and_record_rate_limit(v_user_id, 'create_invite', 50, 3600);

  INSERT INTO public.group_invites (group_id, token_hash, created_by, expires_at, max_uses, used_count, is_revoked)
  VALUES (p_group_id, p_token_hash, v_user_id, p_expires_at, GREATEST(1, LEAST(p_max_uses, 10)), 0, false)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. RPC: XEM TRƯỚC LỜI MỜI (GET PREVIEW - AN TOÀN, KHÔNG GIA NHẬP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_invite_preview(p_token_hash TEXT)
RETURNS TABLE (
    group_id UUID,
    group_name TEXT,
    group_description TEXT,
    group_timezone TEXT,
    member_count BIGINT,
    inviter_display_name TEXT,
    expires_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    invalid_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_group RECORD;
  v_count BIGINT;
  v_inviter_name TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM public.group_invites gi
  WHERE gi.token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, ''::text, ''::text, ''::text, 0::bigint, ''::text, NOW(), false, 'Lời mời không tồn tại hoặc mã token không hợp lệ'::text;
    RETURN;
  END IF;

  SELECT * INTO v_group
  FROM public.groups
  WHERE id = v_invite.group_id;

  IF NOT FOUND OR v_group.status != 'active' THEN
    RETURN QUERY SELECT v_invite.group_id, ''::text, ''::text, ''::text, 0::bigint, ''::text, v_invite.expires_at, false, 'Nhóm không còn hoạt động hoặc đã giải tán'::text;
    RETURN;
  END IF;

  IF v_invite.is_revoked THEN
    RETURN QUERY SELECT v_group.id, v_group.name, v_group.description, v_group.timezone, 0::bigint, ''::text, v_invite.expires_at, false, 'Lời mời đã bị thu hồi'::text;
    RETURN;
  END IF;

  IF v_invite.expires_at <= NOW() THEN
    RETURN QUERY SELECT v_group.id, v_group.name, v_group.description, v_group.timezone, 0::bigint, ''::text, v_invite.expires_at, false, 'Lời mời đã hết hạn'::text;
    RETURN;
  END IF;

  IF v_invite.used_count >= v_invite.max_uses THEN
    RETURN QUERY SELECT v_group.id, v_group.name, v_group.description, v_group.timezone, 0::bigint, ''::text, v_invite.expires_at, false, 'Lời mời đã hết lượt sử dụng'::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.group_members gm
  WHERE gm.group_id = v_group.id AND gm.status = 'active';

  IF v_count >= 5 THEN
    RETURN QUERY SELECT v_group.id, v_group.name, v_group.description, v_group.timezone, v_count, ''::text, v_invite.expires_at, false, 'Nhóm đã đủ tối đa 5 thành viên'::text;
    RETURN;
  END IF;

  SELECT COALESCE(display_name, 'Người quen') INTO v_inviter_name
  FROM public.profiles p
  WHERE p.user_id = v_invite.created_by;

  RETURN QUERY SELECT
    v_group.id,
    v_group.name,
    v_group.description,
    v_group.timezone,
    v_count,
    COALESCE(v_inviter_name, 'Người quen'),
    v_invite.expires_at,
    true,
    NULL::text;
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. RPC: CHẤP NHẬN LỜI MỜI (MUTATION VỚI LOCK/SERIALIZATION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_group_invite(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
  v_group_id UUID;
  v_count INT;
  v_existing_member RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập để chấp nhận lời mời' USING ERRCODE = '42501';
  END IF;

  -- Rate limit: 10 lần accept / 5 phút
  PERFORM public.check_and_record_rate_limit(v_user_id, 'accept_invite', 50, 300);

  SELECT * INTO v_invite
  FROM public.group_invites gi
  WHERE gi.token_hash = p_token_hash
  FOR UPDATE; -- Khóa hàng invite

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lời mời không tồn tại hoặc không hợp lệ' USING ERRCODE = '22023';
  END IF;

  IF v_invite.is_revoked THEN
    RAISE EXCEPTION 'Lời mời đã bị thu hồi' USING ERRCODE = '22023';
  END IF;

  IF v_invite.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Lời mời đã hết hạn' USING ERRCODE = '22023';
  END IF;

  IF v_invite.used_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Lời mời đã hết lượt sử dụng' USING ERRCODE = '22023';
  END IF;

  v_group_id := v_invite.group_id;

  -- Khóa hàng group để serialize các yêu cầu gia nhập đồng thời
  PERFORM id FROM public.groups WHERE id = v_group_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nhóm không còn hoạt động' USING ERRCODE = '22023';
  END IF;

  -- Kiểm tra xem người này đã là thành viên active hay chưa
  IF public.is_active_group_member(v_group_id, v_user_id) THEN
    RAISE EXCEPTION 'Bạn đã là thành viên của nhóm này' USING ERRCODE = '23505';
  END IF;

  -- Đếm số thành viên active hiện tại
  SELECT COUNT(*) INTO v_count
  FROM public.group_members
  WHERE group_id = v_group_id AND status = 'active';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Nhóm đã đạt số lượng tối đa 5 thành viên' USING ERRCODE = '23514';
  END IF;

  -- Kiểm tra bản ghi membership cũ nếu có (re-join)
  SELECT * INTO v_existing_member
  FROM public.group_members
  WHERE group_id = v_group_id AND user_id = v_user_id;

  IF FOUND THEN
    UPDATE public.group_members
    SET status = 'active', role = 'member', joined_at = now(), left_at = NULL
    WHERE id = v_existing_member.id;
  ELSE
    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (v_group_id, v_user_id, 'member', 'active');
  END IF;

  -- Tăng số lượt dùng của token
  UPDATE public.group_invites
  SET used_count = used_count + 1
  WHERE id = v_invite.id;

  RETURN v_group_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. RPC: RỜI NHÓM (LEAVE GROUP - OWNER PHẢI CHUYỂN QUYỀN HOẶC ARCHIVE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_other_active_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_active_group_member(p_group_id, v_user_id) THEN
    RAISE EXCEPTION 'Bạn không phải là thành viên hoạt động của nhóm' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_group_member_role(p_group_id, v_user_id);

  IF v_role = 'owner' THEN
    SELECT COUNT(*) INTO v_other_active_count
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id != v_user_id
      AND status = 'active';

    IF v_other_active_count > 0 THEN
      RAISE EXCEPTION 'Chủ nhóm không thể rời nhóm khi còn thành viên khác. Vui lòng chuyển quyền chủ nhóm hoặc giải tán nhóm.' USING ERRCODE = '22023';
    ELSE
      -- Là thành viên duy nhất: tự động lưu trữ (archive) nhóm khi rời
      UPDATE public.groups
      SET status = 'archived', updated_at = now()
      WHERE id = p_group_id;
    END IF;
  END IF;

  UPDATE public.group_members
  SET status = 'left', left_at = now()
  WHERE group_id = p_group_id AND user_id = v_user_id;

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. RPC: CHUYỂN QUYỀN CHỦ NHÓM (TRANSFER OWNERSHIP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_group_ownership(
    p_group_id UUID,
    p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  v_current_role := public.get_group_member_role(p_group_id, v_user_id);
  IF v_current_role != 'owner' THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm hiện tại mới có quyền chuyển giao quyền sở hữu nhóm' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_active_group_member(p_group_id, p_new_owner_id) THEN
    RAISE EXCEPTION 'Người nhận quyền phải là thành viên đang hoạt động trong nhóm' USING ERRCODE = '22023';
  END IF;

  IF v_user_id = p_new_owner_id THEN
    RETURN TRUE;
  END IF;

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = v_user_id;

  UPDATE public.group_members
  SET role = 'owner'
  WHERE group_id = p_group_id AND user_id = p_new_owner_id;

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 16. RPC: GIẢI TÁN/LƯU TRỮ NHÓM (ARCHIVE GROUP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  v_current_role := public.get_group_member_role(p_group_id, v_user_id);
  IF v_current_role != 'owner' THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm mới có quyền giải tán/lưu trữ nhóm' USING ERRCODE = '42501';
  END IF;

  UPDATE public.groups
  SET status = 'archived', updated_at = now()
  WHERE id = p_group_id;

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 17. RPC: ĐỌC DANH SÁCH THÀNH VIÊN VÀ TÊN HIỂN THỊ (AN TOÀN, KHÔNG LỘ HỒ SƠ)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_member_profiles(p_group_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    role TEXT,
    status TEXT,
    is_muted BOOLEAN,
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Từ chối truy cập: Bạn không phải là thành viên của nhóm này' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    gm.user_id,
    COALESCE(p.display_name, 'Thành viên') AS display_name,
    gm.role,
    gm.status,
    gm.is_muted,
    gm.joined_at
  FROM public.group_members gm
  LEFT JOIN public.profiles p ON p.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
    AND gm.status = 'active'
  ORDER BY
    CASE gm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    gm.joined_at ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 18. RPC: CẬP NHẬT BUỔI HẸN VỚI TỰ ĐỘNG TĂNG REVISION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_group_meetup(
    p_meetup_id UUID,
    p_title TEXT,
    p_scheduled_at TIMESTAMPTZ,
    p_location TEXT,
    p_notes TEXT,
    p_revision_note TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_meetup RECORD;
  v_new_revision INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_meetup
  FROM public.group_meetups
  WHERE id = p_meetup_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buổi hẹn không tồn tại' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_active_group_member(v_meetup.group_id, v_user_id) THEN
    RAISE EXCEPTION 'Bạn không phải là thành viên của nhóm' USING ERRCODE = '42501';
  END IF;

  v_new_revision := v_meetup.revision + 1;

  UPDATE public.group_meetups
  SET
    title = trim(p_title),
    scheduled_at = p_scheduled_at,
    location = NULLIF(trim(p_location), ''),
    notes = NULLIF(trim(p_notes), ''),
    revision = v_new_revision,
    revision_note = NULLIF(trim(p_revision_note), ''),
    last_modified_by = v_user_id,
    updated_at = now()
  WHERE id = p_meetup_id;

  RETURN v_new_revision;
END;
$$;

