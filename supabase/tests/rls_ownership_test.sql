-- ==============================================================================
-- CALISCOACHING MVP - KIỂM TRA QUYỀN SỞ HỮU ROW LEVEL SECURITY (RLS)
-- Mục đích: Kiểm chứng User A không thể đọc/sửa dữ liệu của User B,
-- và Anonymous không thể truy cập bất kỳ dữ liệu cá nhân nào.
-- Có thể chạy trực tiếp trong psql hoặc Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. Tạo 2 người dùng kiểm thử trong auth.users (nếu chưa có)
-- Lưu ý: Dữ liệu giả lập kỹ thuật, không chứa thông tin cá nhân thật
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    uid_b UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Tạo user A
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_a) THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
        VALUES (uid_a, 'test_user_a@example.internal', 'encrypted_secret_dummy', NOW(), '{"provider":"email"}', '{"display_name":"Người dùng A"}');
    END IF;

    -- Tạo user B
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_b) THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
        VALUES (uid_b, 'test_user_b@example.internal', 'encrypted_secret_dummy', NOW(), '{"provider":"email"}', '{"display_name":"Người dùng B"}');
    END IF;
END $$;

-- 2. Giả lập đăng nhập dưới quyền USER A (set auth.uid() = 11111111-...)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- User A tạo hồ sơ
INSERT INTO public.profiles (user_id, display_name, experience_level, available_equipment)
VALUES ('11111111-1111-1111-1111-111111111111', 'Người dùng A', 'beginner', ARRAY['xà đơn'])
ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- User A ghi 1 hoạt động
INSERT INTO public.activities (user_id, activity_type, is_planned, start_at, duration_minutes, fatigue_level, notes, idempotency_key)
VALUES ('11111111-1111-1111-1111-111111111111', 'calisthenics', FALSE, NOW(), 45, 6, 'Buổi tập mẫu của A', 'rls-test-a-1');

-- User A tạo mục tiêu
INSERT INTO public.goals (user_id, content, goal_type)
VALUES ('11111111-1111-1111-1111-111111111111', 'Hít xà được 5 lần', 'skill');

-- User A tạo quan sát chỉ số
INSERT INTO public.observations (user_id, metric_type, metric_value, metric_unit)
VALUES ('11111111-1111-1111-1111-111111111111', 'weight', 65.5, 'kg');

-- User A đồng ý AI
INSERT INTO public.ai_consents (user_id, consent_version, is_granted)
VALUES ('11111111-1111-1111-1111-111111111111', 'v1.0-mvp', TRUE)
ON CONFLICT (user_id, consent_version) DO NOTHING;

-- Kiểm tra User A đọc được chính dữ liệu của mình
DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt FROM public.profiles WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF cnt <> 1 THEN RAISE EXCEPTION 'RLS LỖI: User A không đọc được hồ sơ của mình'; END IF;

    SELECT COUNT(*) INTO cnt FROM public.activities WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF cnt < 1 THEN RAISE EXCEPTION 'RLS LỖI: User A không đọc được hoạt động của mình'; END IF;
    
    RAISE NOTICE '✅ XÁC NHẬN: User A thao tác thành công trên dữ liệu của chính mình.';
END $$;

-- 3. Chuyển ngữ cảnh sang USER B (set auth.uid() = 22222222-...)
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

-- Kiểm tra User B KHÔNG THỂ đọc dữ liệu của User A
DO $$
DECLARE
    cnt_profile INT;
    cnt_activities INT;
    cnt_goals INT;
    cnt_obs INT;
BEGIN
    SELECT COUNT(*) INTO cnt_profile FROM public.profiles WHERE user_id = '11111111-1111-1111-1111-111111111111';
    SELECT COUNT(*) INTO cnt_activities FROM public.activities WHERE user_id = '11111111-1111-1111-1111-111111111111';
    SELECT COUNT(*) INTO cnt_goals FROM public.goals WHERE user_id = '11111111-1111-1111-1111-111111111111';
    SELECT COUNT(*) INTO cnt_obs FROM public.observations WHERE user_id = '11111111-1111-1111-1111-111111111111';

    IF cnt_profile <> 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B nhìn thấy hồ sơ của User A!';
    END IF;
    IF cnt_activities <> 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B nhìn thấy hoạt động của User A!';
    END IF;
    IF cnt_goals <> 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B nhìn thấy mục tiêu của User A!';
    END IF;
    IF cnt_obs <> 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B nhìn thấy quan sát sức khỏe của User A!';
    END IF;

    RAISE NOTICE '✅ XÁC NHẬN BẢO MẬT RLS: User B không thấy bất kỳ bản ghi nào của User A.';
END $$;

-- Kiểm tra User B cố ý sửa hoặc xóa dữ liệu User A (phải tác động 0 hàng)
DO $$
DECLARE
    rows_affected INT;
BEGIN
    UPDATE public.activities SET notes = 'Hacker note' WHERE user_id = '11111111-1111-1111-1111-111111111111';
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B sửa được hoạt động của User A!';
    END IF;

    DELETE FROM public.profiles WHERE user_id = '11111111-1111-1111-1111-111111111111';
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B xóa được hồ sơ của User A!';
    END IF;

    RAISE NOTICE '✅ XÁC NHẬN BẢO MẬT RLS: User B không thể UPDATE hoặc DELETE bản ghi của User A.';
END $$;

-- Kiểm tra User B chèn bản ghi mang user_id của A (WITH CHECK phải chặn)
DO $$
BEGIN
    BEGIN
        INSERT INTO public.activities (user_id, activity_type, start_at, duration_minutes, idempotency_key)
        VALUES ('11111111-1111-1111-1111-111111111111', 'running', NOW(), 20, 'rls-test-spoof');
        RAISE EXCEPTION 'VI PHẠM BẢO MẬT: User B chèn được hoạt động mang user_id của User A!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '✅ XÁC NHẬN BẢO MẬT RLS: User B không thể chèn dữ liệu mạo danh User A.';
    END;

    BEGIN
        INSERT INTO public.ai_summaries (user_id, status, content)
        VALUES ('22222222-2222-2222-2222-222222222222', 'ai_generated', 'giả lập');
        RAISE EXCEPTION 'VI PHẠM: Client tự tạo được tóm tắt ai_generated!';
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '✅ XÁC NHẬN: Client không tự ghi được bảng ai_summaries.';
    END;
END $$;

-- 4. Chuyển sang Anonymous (người dùng chưa đăng nhập)
SET LOCAL ROLE anon;
RESET request.jwt.claim.sub;

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt FROM public.profiles;
    IF cnt <> 0 THEN RAISE EXCEPTION 'VI PHẠM BẢO MẬT: Anonymous đọc được bảng profiles!'; END IF;

    SELECT COUNT(*) INTO cnt FROM public.activities;
    IF cnt <> 0 THEN RAISE EXCEPTION 'VI PHẠM BẢO MẬT: Anonymous đọc được bảng activities!'; END IF;

    RAISE NOTICE '✅ XÁC NHẬN BẢO MẬT RLS: Anonymous bị chặn hoàn toàn truy cập dữ liệu cá nhân.';
END $$;

-- Hoàn tác giao dịch kiểm thử để không làm biến đổi môi trường vĩnh viễn
ROLLBACK;
