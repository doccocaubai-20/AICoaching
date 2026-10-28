-- ==============================================================================
-- CALISCOACHING - MIGRATION 20261028000012 (AGENT C)
-- D4 Hành trình kỹ năng có bằng chứng & D6 Video đối chiếu với chính mình
--
-- NGUYÊN TẮC:
-- 1. Bốn trạng thái mốc tách bạch: not_attempted, attempted, self_reported_achieved, needs_review.
-- 2. Mở nội dung, tích lũy XP và đạt mốc là 3 việc riêng biệt; không dùng XP tự cấp Verified.
-- 3. Lưu giữ mọi lần thử (kể cả không đạt) để theo dõi tiến trình thực tế.
-- 4. Khi bản ghi nguồn (activity/session) bị sửa hoặc xóa -> lần thử đổi sang needs_review.
-- 5. Bucket 'comparison_videos' và metadata tách hoàn toàn khỏi health_documents.
-- 6. Quota upload: 20 MiB/file (integer bytes), 100 MiB/user tổng dung lượng video.
-- 7. Upload trực tiếp Storage bằng grant giới hạn; finalize kiểm tra object tồn tại; tombstone deletion.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG SKILL_JOURNEYS (Định nghĩa Hành trình Kỹ năng Mẫu)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_journeys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content_source TEXT NOT NULL,
    criteria_version TEXT NOT NULL DEFAULT 'v1.0.0-pilot',
    is_demo_illustration BOOLEAN NOT NULL DEFAULT true,
    disclaimer TEXT NOT NULL DEFAULT 'Nội dung minh họa cho mục đích thử nghiệm tiến trình kỹ năng, chưa qua hội đồng chuyên môn y tế / thể thao rà soát. Không khẳng định chuẩn huấn luyện hay cam kết kết quả thể chất.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_journeys ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng đã đăng nhập hoặc khách đều xem được danh mục hành trình
CREATE POLICY "skill_journeys_read_all" ON public.skill_journeys
    FOR SELECT TO authenticated, anon
    USING (true);

-- ------------------------------------------------------------------------------
-- 2. BẢNG SKILL_MILESTONES (Các Mốc Tiêu Chí trong Hành Trình)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skill_milestones (
    id TEXT PRIMARY KEY,
    journey_id TEXT NOT NULL REFERENCES public.skill_journeys(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    criteria_description TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    assistance TEXT NOT NULL DEFAULT 'bodyweight',
    target_reps INTEGER CHECK (target_reps IS NULL OR target_reps > 0),
    target_duration_seconds INTEGER CHECK (target_duration_seconds IS NULL OR target_duration_seconds > 0),
    criteria_version TEXT NOT NULL DEFAULT 'v1.0.0-pilot',
    is_demo_illustration BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(journey_id, sequence_order)
);

ALTER TABLE public.skill_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_milestones_read_all" ON public.skill_milestones
    FOR SELECT TO authenticated, anon
    USING (true);

-- ------------------------------------------------------------------------------
-- 3. BẢNG JOURNEY_VIDEOS (Metadata Clip Đối Chiếu Riêng Tư)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('video/mp4', 'video/webm')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 20971520), -- Max 20 MiB integer bytes
    storage_path TEXT NOT NULL UNIQUE,
    client_estimated_duration_seconds INTEGER CHECK (client_estimated_duration_seconds IS NULL OR client_estimated_duration_seconds >= 0),
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'ready', 'pending_deletion', 'deleted')),
    idempotency_key TEXT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
    finalized_at TIMESTAMPTZ,
    deletion_requested_at TIMESTAMPTZ,
    deletion_failed BOOLEAN NOT NULL DEFAULT false,
    deletion_attempts INTEGER NOT NULL DEFAULT 0,
    deletion_error TEXT,
    timestamp_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT journey_videos_storage_path_user_prefix CHECK (storage_path LIKE (user_id::TEXT || '/%'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_videos_idempotency 
    ON public.journey_videos(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journey_videos_user_status 
    ON public.journey_videos(user_id, status);

ALTER TABLE public.journey_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_videos_select_own" ON public.journey_videos
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id AND status != 'deleted');

CREATE POLICY "journey_videos_insert_own" ON public.journey_videos
    FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = user_id
      AND status = 'reserved'
      AND file_size_bytes > 0
      AND file_size_bytes <= 20971520
    );

CREATE POLICY "journey_videos_update_own" ON public.journey_videos
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.protect_journey_video_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Cho phép cập nhật qua các RPC quản lý video (finalize, mark deletion, cleanup)
  IF current_setting('app.allow_video_metadata_mutation', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NEW.id != OLD.id OR NEW.user_id != OLD.user_id OR NEW.file_size_bytes != OLD.file_size_bytes OR NEW.storage_path != OLD.storage_path OR NEW.status != OLD.status THEN
      RAISE EXCEPTION 'Không được phép thay đổi thông tin hạn mức dung lượng hoặc trạng thái video trực tiếp' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_journey_video_metadata ON public.journey_videos;
CREATE TRIGGER trg_protect_journey_video_metadata
BEFORE UPDATE ON public.journey_videos
FOR EACH ROW
EXECUTE FUNCTION public.protect_journey_video_metadata();

CREATE POLICY "journey_videos_delete_own" ON public.journey_videos
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. BẢNG JOURNEY_ATTEMPTS (Lần Thử Kỹ Năng Của Người Dùng)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journey_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    journey_id TEXT NOT NULL REFERENCES public.skill_journeys(id) ON DELETE CASCADE,
    milestone_id TEXT NOT NULL REFERENCES public.skill_milestones(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    exercise_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    assistance TEXT NOT NULL DEFAULT 'bodyweight',
    actual_reps INTEGER CHECK (actual_reps IS NULL OR actual_reps >= 0),
    actual_duration_seconds INTEGER CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds >= 0),
    notes TEXT,
    is_achieved_self_reported BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'attempted' CHECK (status IN ('attempted', 'self_reported_achieved', 'needs_review')),
    source_ref JSONB, -- { "sourceType": "activity"|"session_result", "sourceId": "...", "sourceVersionHash": "...", "recordedAt": "..." }
    source_invalidated_at TIMESTAMPTZ,
    source_invalidation_reason TEXT,
    video_id UUID REFERENCES public.journey_videos(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT journey_attempts_metric_present CHECK (actual_reps IS NOT NULL OR actual_duration_seconds IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_attempts_idempotency 
    ON public.journey_attempts(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journey_attempts_user_milestone 
    ON public.journey_attempts(user_id, milestone_id, attempted_at DESC);

ALTER TABLE public.journey_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journey_attempts_select_own" ON public.journey_attempts
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "journey_attempts_insert_own" ON public.journey_attempts
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journey_attempts_update_own" ON public.journey_attempts
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journey_attempts_delete_own" ON public.journey_attempts
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. RPC & QUOTA MANAGEMENT CHO VIDEO (AGENT C)
-- ------------------------------------------------------------------------------

-- 5.1 Giữ chỗ upload và kiểm tra quota đồng thời
CREATE OR REPLACE FUNCTION public.reserve_journey_video_upload(
    p_idempotency_key TEXT,
    p_exercise_id TEXT,
    p_variant_id TEXT,
    p_file_name TEXT,
    p_file_type TEXT,
    p_file_size_bytes INTEGER,
    p_storage_path TEXT,
    p_client_duration INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_used_bytes BIGINT;
    v_video_id UUID;
    v_existing_id UUID;
    v_existing_status TEXT;
    v_existing_expires TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Kiểm tra kích thước: tối đa 20 MiB (20,971,520 bytes)
    IF p_file_size_bytes < 1 OR p_file_size_bytes > 20971520 THEN
        RAISE EXCEPTION 'File size outside allowed range (1 byte to 20 MiB)' USING ERRCODE = '22023';
    END IF;

    -- Kiểm tra định dạng MIME
    IF p_file_type NOT IN ('video/mp4', 'video/webm') THEN
        RAISE EXCEPTION 'Unsupported video format. Only video/mp4 and video/webm allowed.' USING ERRCODE = '22023';
    END IF;

    -- Kiểm tra path hợp lệ theo prefix user_id
    IF p_storage_path NOT LIKE (v_user_id::TEXT || '/%') THEN
        RAISE EXCEPTION 'Storage path must be prefixed with user ID' USING ERRCODE = '42501';
    END IF;

    -- Khóa tuần tự hóa người dùng theo transaction để chống race condition quota
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 909090));

    -- Kiểm tra Idempotency
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT id, status, expires_at INTO v_existing_id, v_existing_status, v_existing_expires
        FROM public.journey_videos
        WHERE user_id = v_user_id AND idempotency_key = trim(p_idempotency_key)
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            IF v_existing_status = 'ready' THEN
                RETURN v_existing_id;
            ELSIF v_existing_status = 'reserved' AND v_existing_expires > now() THEN
                RETURN v_existing_id;
            END IF;
        END IF;
    END IF;

    -- Tính tổng dung lượng hiện tại đã cam kết (ready) + các lượt giữ chỗ còn hiệu lực (reserved)
    SELECT COALESCE(SUM(file_size_bytes), 0)
    INTO v_used_bytes
    FROM public.journey_videos
    WHERE user_id = v_user_id
      AND (
          status = 'ready'
          OR (status = 'reserved' AND expires_at > now())
      );

    -- Hạn mức tối đa 100 MiB (104,857,600 bytes)
    IF v_used_bytes + p_file_size_bytes > 104857600 THEN
        RAISE EXCEPTION 'User video storage quota exceeded (100 MiB limit)' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.journey_videos (
        user_id,
        exercise_id,
        variant_id,
        file_name,
        file_type,
        file_size_bytes,
        storage_path,
        client_estimated_duration_seconds,
        status,
        idempotency_key,
        reserved_at,
        expires_at
    ) VALUES (
        v_user_id,
        trim(p_exercise_id),
        trim(p_variant_id),
        trim(p_file_name),
        p_file_type,
        p_file_size_bytes,
        p_storage_path,
        p_client_duration,
        'reserved',
        NULLIF(trim(p_idempotency_key), ''),
        now(),
        now() + INTERVAL '15 minutes'
    ) RETURNING id INTO v_video_id;

    RETURN v_video_id;
END;
$$;

-- 5.2 Xác thực hoàn tất tải lên (Finalize)
CREATE OR REPLACE FUNCTION public.finalize_journey_video_upload(
    p_video_id UUID,
    p_actual_size_bytes INTEGER,
    p_actual_mime_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reserved_size INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT file_size_bytes INTO v_reserved_size
    FROM public.journey_videos
    WHERE id = p_video_id
      AND user_id = v_user_id
      AND status = 'reserved'
      AND expires_at > now();

    IF v_reserved_size IS NULL THEN
        RAISE EXCEPTION 'No active valid reservation found for video' USING ERRCODE = 'P0002';
    END IF;

    -- Kiểm tra kích thước thực tế không được vượt quá 20 MiB
    IF p_actual_size_bytes < 1 OR p_actual_size_bytes > 20971520 THEN
        RAISE EXCEPTION 'Actual file size exceeds allowed limit' USING ERRCODE = '22023';
    END IF;

    IF p_actual_mime_type NOT IN ('video/mp4', 'video/webm') THEN
        RAISE EXCEPTION 'Unsupported video MIME type' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.allow_video_metadata_mutation', 'true', true);

    UPDATE public.journey_videos
    SET status = 'ready',
        file_size_bytes = p_actual_size_bytes,
        file_type = p_actual_mime_type,
        finalized_at = now(),
        updated_at = now()
    WHERE id = p_video_id AND user_id = v_user_id;

    RETURN p_video_id;
END;
$$;

-- 5.3 Đánh dấu xóa có Tombstone (Pending Deletion)
CREATE OR REPLACE FUNCTION public.mark_journey_video_for_deletion(p_video_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_storage_path TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT storage_path INTO v_storage_path
    FROM public.journey_videos
    WHERE id = p_video_id AND user_id = v_user_id;

    IF v_storage_path IS NULL THEN
        RAISE EXCEPTION 'Video not found or not owned by user' USING ERRCODE = 'P0002';
    END IF;

    PERFORM set_config('app.allow_video_metadata_mutation', 'true', true);

    -- Chuyển trạng thái sang pending_deletion ngay lập tức để chặn cấp URL mới
    UPDATE public.journey_videos
    SET status = 'pending_deletion',
        deletion_requested_at = now(),
        updated_at = now()
    WHERE id = p_video_id AND user_id = v_user_id;

    -- Gỡ liên kết video khỏi tất cả các lần thử của người dùng mà KHÔNG xóa lần thử
    UPDATE public.journey_attempts
    SET video_id = NULL,
        updated_at = now()
    WHERE video_id = p_video_id AND user_id = v_user_id;

    RETURN v_storage_path;
END;
$$;

-- 5.4 Xác nhận kết quả xóa Storage (Xử lý retry)
CREATE OR REPLACE FUNCTION public.confirm_journey_video_deleted(
    p_video_id UUID,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    PERFORM set_config('app.allow_video_metadata_mutation', 'true', true);

    IF p_success THEN
        UPDATE public.journey_videos
        SET status = 'deleted',
            deletion_failed = false,
            updated_at = now()
        WHERE id = p_video_id AND user_id = v_user_id;
    ELSE
        UPDATE public.journey_videos
        SET deletion_failed = true,
            deletion_attempts = deletion_attempts + 1,
            deletion_error = p_error_message,
            updated_at = now()
        WHERE id = p_video_id AND user_id = v_user_id;
    END IF;
END;
$$;

-- 5.5 Dọn dẹp các lượt giữ chỗ upload bị bỏ dở (Runnable local / isolated)
CREATE OR REPLACE FUNCTION public.cleanup_expired_journey_video_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    PERFORM set_config('app.allow_video_metadata_mutation', 'true', true);

    UPDATE public.journey_videos
    SET status = 'deleted',
        updated_at = now()
    WHERE status = 'reserved'
      AND expires_at < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS ĐÁNH DẤU NEEDS_REVIEW KHI NGUỒN LIÊN KẾT BỊ SỬA HOẶC XÓA
-- ------------------------------------------------------------------------------

-- 6.1 Trigger khi bảng activities bị chỉnh sửa hoặc xóa
CREATE OR REPLACE FUNCTION public.trg_invalidate_attempts_on_activity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND (OLD.start_at != NEW.start_at OR OLD.duration_minutes != NEW.duration_minutes OR OLD.activity_type != NEW.activity_type)) THEN
        UPDATE public.journey_attempts
        SET status = 'needs_review',
            source_invalidated_at = now(),
            source_invalidation_reason = CASE 
                WHEN TG_OP = 'DELETE' THEN 'Hoạt động nền liên kết đã bị xóa khỏi nhật ký.'
                ELSE 'Hoạt động nền liên kết đã bị thay đổi thời gian hoặc loại hình.'
            END,
            updated_at = now()
        WHERE source_ref IS NOT NULL
          AND (source_ref->>'sourceType' = 'activity' OR source_ref->>'type' = 'activity')
          AND (source_ref->>'sourceId' = OLD.id::TEXT OR source_ref->>'id' = OLD.id::TEXT);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_attempts_activity_invalidation ON public.activities;
CREATE TRIGGER trg_journey_attempts_activity_invalidation
    AFTER UPDATE OR DELETE ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_invalidate_attempts_on_activity_change();

-- 6.2 Trigger khi bảng session_results bị chỉnh sửa hoặc xóa
CREATE OR REPLACE FUNCTION public.trg_invalidate_attempts_on_session_result_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE') THEN
        UPDATE public.journey_attempts
        SET status = 'needs_review',
            source_invalidated_at = now(),
            source_invalidation_reason = CASE 
                WHEN TG_OP = 'DELETE' THEN 'Kết quả buổi tập nền đã bị xóa.'
                ELSE 'Kết quả buổi tập nền đã bị cập nhật lại.'
            END,
            updated_at = now()
        WHERE source_ref IS NOT NULL
          AND (source_ref->>'sourceType' = 'session_result' OR source_ref->>'type' = 'session_result')
          AND (source_ref->>'sourceId' = OLD.id::TEXT OR source_ref->>'id' = OLD.id::TEXT);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_journey_attempts_session_result_invalidation ON public.session_results;
CREATE TRIGGER trg_journey_attempts_session_result_invalidation
    AFTER UPDATE OR DELETE ON public.session_results
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_invalidate_attempts_on_session_result_change();

-- ------------------------------------------------------------------------------
-- 7. THIẾT LẬP BUCKET STORAGE VÀ STORAGE POLICIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('comparison_videos', 'comparison_videos', false, 20971520, ARRAY['video/mp4', 'video/webm'])
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 20971520,
            allowed_mime_types = ARRAY['video/mp4', 'video/webm'];
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "comparison_videos_owner_select" ON storage.objects;
        DROP POLICY IF EXISTS "comparison_videos_owner_insert" ON storage.objects;
        DROP POLICY IF EXISTS "comparison_videos_owner_update" ON storage.objects;
        DROP POLICY IF EXISTS "comparison_videos_owner_delete" ON storage.objects;

        CREATE POLICY "comparison_videos_owner_select" ON storage.objects
            FOR SELECT TO authenticated
            USING (bucket_id = 'comparison_videos' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

        CREATE POLICY "comparison_videos_owner_insert" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'comparison_videos'
                AND auth.uid()::TEXT = (storage.foldername(name))[1]
                AND EXISTS (
                    SELECT 1 FROM public.journey_videos
                    WHERE user_id = auth.uid()
                      AND storage_path = name
                      AND status = 'reserved'
                      AND expires_at > now()
                )
            );

        CREATE POLICY "comparison_videos_owner_update" ON storage.objects
            FOR UPDATE TO authenticated
            USING (bucket_id = 'comparison_videos' AND auth.uid()::TEXT = (storage.foldername(name))[1]);

        CREATE POLICY "comparison_videos_owner_delete" ON storage.objects
            FOR DELETE TO authenticated
            USING (bucket_id = 'comparison_videos' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. DỮ LIỆU MẪU BAN ĐẦU: HÀNH TRÌNH HÍT XÀ ĐƠN (PULL-UP MASTERY)
-- ------------------------------------------------------------------------------
INSERT INTO public.skill_journeys (
    id, title, description, content_source, criteria_version, is_demo_illustration, disclaimer
) VALUES (
    'pull_up_mastery',
    'Hành trình Chinh phục Hít xà đơn (Pull-up Mastery)',
    'Tiến trình phát triển sức mạnh kéo cơ bản: từ treo xà tĩnh (Dead Hang), kéo xà nghiêng (Inverted Row), hạ chậm có kiểm soát (Negative Pull-up) đến hít xà chuẩn form hoàn chỉnh.',
    'Calisthenics Foundation Curated Curriculum v1',
    'v1.0.0-pilot',
    true,
    'Nội dung minh họa cho mục đích thử nghiệm tiến trình kỹ năng, chưa qua hội đồng chuyên môn y tế / thể thao rà soát. Không khẳng định chuẩn huấn luyện hay cam kết kết quả thể chất.'
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content_source = EXCLUDED.content_source,
    criteria_version = EXCLUDED.criteria_version,
    disclaimer = EXCLUDED.disclaimer;

INSERT INTO public.skill_milestones (
    id, journey_id, sequence_order, title, description, criteria_description,
    exercise_id, variant_id, assistance, target_reps, target_duration_seconds, criteria_version, is_demo_illustration
) VALUES
(
    'dead_hang_30s',
    'pull_up_mastery',
    1,
    'Mốc 1: Dead Hang (Treo xà tĩnh kích hoạt khớp vai)',
    'Treo người tĩnh trên thanh xà đơn để rèn sức nắm bàn tay, cẳng tay và giải nén cột sống lưng.',
    'Treo người tĩnh hai tay nắm chắc thanh xà, vai kích hoạt (active shoulders), không đung đưa thân người, duy trì liên tục tối thiểu 30 giây.',
    'dead_hang',
    'active_grip',
    'bodyweight',
    NULL,
    30,
    'v1.0.0-pilot',
    true
),
(
    'inverted_row_8',
    'pull_up_mastery',
    2,
    'Mốc 2: Inverted Row (Kéo xà nghiêng / Australian Pull-up)',
    'Bài kéo ngang trên xà thấp giúp kích hoạt cơ xô, cơ lưng giữa và chuẩn bị lực kéo cơ bản.',
    'Thân người thẳng từ gót chân đến đầu, kéo ngực chạm thanh xà thấp, kiểm soát pha hạ (eccentric) 2 giây, thực hiện tối thiểu 8 lần chuẩn form.',
    'inverted_row',
    'horizontal_bar',
    'bodyweight',
    8,
    NULL,
    'v1.0.0-pilot',
    true
),
(
    'negative_pull_up_5',
    'pull_up_mastery',
    3,
    'Mốc 3: Negative Pull-up (Hít xà hạ chậm có kiểm soát)',
    'Rèn luyện sức mạnh co cơ lệch tâm (eccentric strength) của nhóm cơ kéo xà.',
    'Nhảy hoặc bước lên để cằm vượt thanh xà, hạ người từ từ có kiểm soát trong tối thiểu 4 giây mỗi lần, thực hiện 5 lần không rơi tự do.',
    'negative_pull_up',
    'slow_eccentric',
    'bodyweight',
    5,
    NULL,
    'v1.0.0-pilot',
    true
),
(
    'standard_pull_up_1',
    'pull_up_mastery',
    4,
    'Mốc 4: Standard Pull-up (Hít xà đơn tiêu chuẩn)',
    'Cột mốc đầu tiên của calisthenics: hít xà đầy đủ biên độ chuyển động không dùng quán tính.',
    'Bắt đầu từ vị trí Dead Hang thẳng tay hoàn toàn, kéo cằm vượt hẳn qua thanh xà mà không dùng đà văng chân (kipping), hạ người có kiểm soát về điểm xuất phát, tối thiểu 1 rep chuẩn.',
    'standard_pull_up',
    'deadstop',
    'bodyweight',
    1,
    NULL,
    'v1.0.0-pilot',
    true
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    criteria_description = EXCLUDED.criteria_description,
    target_reps = EXCLUDED.target_reps,
    target_duration_seconds = EXCLUDED.target_duration_seconds;
