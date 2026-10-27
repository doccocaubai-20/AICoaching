-- ==============================================================================
-- CALISCOACHING MVP - SEED DATA (MINH HỌA DEMO)
-- LƯU Ý BẢO MẬT & QUY ĐỊNH:
-- 1. TUYỆT ĐỐI KHÔNG DÙNG DỮ LIỆU THỰC TẾ CỦA BẤT KỲ CÁ NHÂN NÀO.
-- 2. TẤT CẢ GIÁO TRÌNH VÀ BÀI TẬP LÀ MINH HỌA DEMO KỸ THUẬT, CHƯA ĐƯỢC
--    XÁC THỰC BỞI CHUYÊN GIA Y TẾ HOẶC HLV THỂ THAO CHUYÊN NGHIỆP.
-- ==============================================================================

-- 1. Tạo chương trình calisthenics minh họa cấp hệ thống (user_id IS NULL)
INSERT INTO public.programs (id, user_id, title, version, status, description, is_demo)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    NULL,
    'Calisthenics Cơ Bản Minh Họa (Demo)',
    '1.0.0-demo',
    'demo_illustration',
    'Chương trình bài tập nền tảng calisthenics phục vụ mục đích kiểm thử và demo giao diện ứng dụng. Chưa qua thẩm định y khoa/thể thao.',
    TRUE
) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 2. Buổi tập mẫu 1: Kéo xà và Chống đẩy cơ bản
INSERT INTO public.sessions (id, program_id, user_id, title, sequence_order, exercises, is_demo)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    NULL,
    'Buổi 1: Thân trên - Kéo & Đẩy cơ bản (Demo)',
    1,
    '[
        {"name": "Hít xà đơn (Pull-up) có trợ lực hoặc chuẩn", "sets": 3, "target_reps": "5-8", "rest_seconds": 90, "note": "Minh họa demo"},
        {"name": "Chống đẩy (Push-up) tiêu chuẩn", "sets": 3, "target_reps": "8-12", "rest_seconds": 60, "note": "Minh họa demo"},
        {"name": "Treo mình trên xà (Dead hang)", "sets": 3, "target_reps": "20-30s", "rest_seconds": 60, "note": "Minh họa demo"}
    ]'::jsonb,
    TRUE
) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 3. Buổi tập mẫu 2: Thân dưới & Core cơ bản
INSERT INTO public.sessions (id, program_id, user_id, title, sequence_order, exercises, is_demo)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    NULL,
    'Buổi 2: Chân & Cơ bụng (Demo)',
    2,
    '[
        {"name": "Squat thể trọng (Bodyweight squat)", "sets": 3, "target_reps": "12-15", "rest_seconds": 60, "note": "Minh họa demo"},
        {"name": "Plank giữ thân thẳng", "sets": 3, "target_reps": "30-45s", "rest_seconds": 60, "note": "Minh họa demo"},
        {"name": "Chùng chân luân phiên (Walking lunges)", "sets": 3, "target_reps": "10 mỗi chân", "rest_seconds": 60, "note": "Minh họa demo"}
    ]'::jsonb,
    TRUE
) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
