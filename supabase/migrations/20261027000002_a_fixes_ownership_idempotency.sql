-- ==============================================================================
-- CALISCOACHING MVP - MIGRATION 20261027000002
-- Sửa nền tảng A sau rà soát:
-- 1. Tự tạo hồ sơ khi có tài khoản mới (không phụ thuộc phiên phía client).
-- 2. Chống ghi trùng activities và session_results bằng idempotency_key bắt buộc.
-- 3. Bảng AI chỉ được ghi từ server (service role); client chỉ đọc/xóa.
-- 4. Bản ghi con phải cùng chủ sở hữu với bản ghi cha.
-- 5. Sửa/xóa hoạt động đánh dấu gợi ý xem lại liên quan là 'outdated'.
-- 6. Giá trị mặc định thời gian dùng now() (timestamptz thật), tóm tắt AI không mặc định là demo.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TỰ TẠO HỒ SƠ KHI ĐĂNG KÝ
-- Đọc display_name / experience_level từ user metadata do form đăng ký gửi lên.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    level TEXT := meta->>'experience_level';
BEGIN
    IF level IS NULL OR level NOT IN ('beginner', 'intermediate', 'advanced') THEN
        level := 'beginner';
    END IF;

    INSERT INTO public.profiles (user_id, display_name, experience_level)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(meta->>'display_name'), ''), 'Người dùng mới'),
        level
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. CHỐNG GHI TRÙNG
-- Client sinh idempotency_key một lần khi mở form và gửi lại cùng khóa nếu bấm lưu lặp.
-- ------------------------------------------------------------------------------
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
UPDATE public.activities SET idempotency_key = id::text WHERE idempotency_key IS NULL;
ALTER TABLE public.activities ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE public.activities
    ADD CONSTRAINT uq_activities_user_idempotency UNIQUE (user_id, idempotency_key);

-- Ràng buộc cũ dựa trên completed_at = now() nên không chặn được bấm lưu lặp
ALTER TABLE public.session_results DROP CONSTRAINT IF EXISTS uq_session_user_completed;
DROP INDEX IF EXISTS public.idx_session_results_idempotency;
UPDATE public.session_results SET idempotency_key = id::text WHERE idempotency_key IS NULL;
ALTER TABLE public.session_results ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE public.session_results
    ADD CONSTRAINT uq_session_results_user_idempotency UNIQUE (user_id, idempotency_key);

-- ------------------------------------------------------------------------------
-- 3. BẢNG AI CHỈ GHI TỪ SERVER
-- Ngăn trình duyệt tự tạo bản ghi status='ai_generated' hoặc tin nhắn role='assistant'.
-- Server ghi bằng service role SAU KHI đã xác thực người dùng và kiểm tra đồng ý.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_summaries_insert_own" ON public.ai_summaries;
DROP POLICY IF EXISTS "ai_summaries_update_own" ON public.ai_summaries;
DROP POLICY IF EXISTS "ai_messages_insert_own" ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_update_own" ON public.ai_messages;
REVOKE INSERT, UPDATE ON public.ai_summaries FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.ai_messages FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. BẢN GHI CON CÙNG CHỦ SỞ HỮU VỚI BẢN GHI CHA
-- ------------------------------------------------------------------------------
-- ai_messages: khóa ngoại kép (conversation_id, user_id) áp dụng cả với service role
ALTER TABLE public.ai_conversations
    ADD CONSTRAINT uq_ai_conversations_id_user UNIQUE (id, user_id);
ALTER TABLE public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_conversation_id_fkey;
ALTER TABLE public.ai_messages
    ADD CONSTRAINT fk_ai_messages_conversation_owner
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.ai_conversations(id, user_id) ON DELETE CASCADE;

-- sessions: chỉ gắn vào chương trình hệ thống hoặc chương trình của chính mình
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;

CREATE POLICY "sessions_insert_own" ON public.sessions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.programs p
            WHERE p.id = program_id AND (p.user_id IS NULL OR p.user_id = auth.uid())
        )
    );

CREATE POLICY "sessions_update_own" ON public.sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.programs p
            WHERE p.id = program_id AND (p.user_id IS NULL OR p.user_id = auth.uid())
        )
    );

-- session_results: chỉ ghi kết quả cho buổi tập hệ thống hoặc buổi tập của chính mình
DROP POLICY IF EXISTS "session_results_insert_own" ON public.session_results;
DROP POLICY IF EXISTS "session_results_update_own" ON public.session_results;

CREATE POLICY "session_results_insert_own" ON public.session_results
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id AND (s.user_id IS NULL OR s.user_id = auth.uid())
        )
    );

CREATE POLICY "session_results_update_own" ON public.session_results
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_id AND (s.user_id IS NULL OR s.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 5. ĐÁNH DẤU GỢI Ý CŨ KHI HOẠT ĐỘNG NGUỒN THAY ĐỔI
-- Chạy với quyền người gọi, nên RLS vẫn giới hạn trong dữ liệu của chính người dùng.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_review_suggestions_outdated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.review_suggestions
    SET status = 'outdated'
    WHERE user_id = OLD.user_id
      AND OLD.id = ANY(reference_activity_ids)
      AND status IN ('pending', 'acknowledged');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_activities_mark_suggestions_outdated ON public.activities;
CREATE TRIGGER trg_activities_mark_suggestions_outdated
    AFTER UPDATE OR DELETE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.mark_review_suggestions_outdated();

-- ------------------------------------------------------------------------------
-- 6. MẶC ĐỊNH THỜI GIAN VÀ NHÃN DEMO
-- TIMEZONE('utc', NOW()) trả về timestamp không múi giờ, chỉ đúng khi phiên ở UTC.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp with time zone'
          AND column_default ILIKE '%timezone(%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT now()', col.table_name, col.column_name);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tóm tắt AI thật không phải dữ liệu demo; server đặt is_demo = true khi dùng hồ sơ mẫu
ALTER TABLE public.ai_summaries ALTER COLUMN is_demo SET DEFAULT FALSE;
