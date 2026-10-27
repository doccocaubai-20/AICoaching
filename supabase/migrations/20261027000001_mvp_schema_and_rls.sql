-- ==============================================================================
-- CALISCOACHING MVP - MIGRATION 20261027000001
-- Schema & RLS cho MVP: Hồ sơ sức khỏe & vận động cá nhân + Tương tác AI
-- 
-- TUÂN THỦ NGUYÊN TẮC:
-- 1. Quyền sở hữu nghiêm ngặt: Mỗi người dùng chỉ đọc/sửa dữ liệu của mình (auth.uid() = user_id).
-- 2. KHÔNG có mô hình chia sẻ, HLV (coach), bạn bè hay quyền công khai.
-- 3. Toàn bộ bảng kích hoạt Row Level Security (RLS).
-- 4. Bảng bài tập/quy tắc demo có nhãn is_demo / demo_illustration rõ ràng.
-- 5. Chống ghi trùng với session_results bằng unique constraint / idempotency_key.
-- 6. Tôn trọng dữ liệu thiếu: trường vắng là NULL, không tự suy ra 0.
-- ==============================================================================

-- Bật extension pgcrypto nếu chưa có
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. BẢNG PROFILES (Hồ sơ người dùng)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
    schedule_availability JSONB NOT NULL DEFAULT '[]'::jsonb, -- Lịch rảnh trong tuần
    available_equipment TEXT[] NOT NULL DEFAULT '{}',         -- Dụng cụ có sẵn (xà đơn, dây kháng lực, sàn nhà...)
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own" ON public.profiles
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. BẢNG GOALS (Mục tiêu cá nhân)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('skill', 'endurance', 'habit', 'strength', 'other')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON public.goals
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own" ON public.goals
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON public.goals
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON public.goals
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. BẢNG OBSERVATIONS (Chỉ số tự quan sát / tự khai)
-- Ghi chú: Chiều cao/cân nặng tự khai theo ngày, KHÔNG tạo điểm sức khỏe tổng hợp
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('weight', 'height', 'resting_heart_rate', 'body_feel', 'other')),
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT NOT NULL, -- 'kg', 'cm', 'bpm', 'scale_1_10', ...
    observed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    source TEXT NOT NULL DEFAULT 'self_reported' CHECK (source IN ('self_reported', 'manual_import')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observations_select_own" ON public.observations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "observations_insert_own" ON public.observations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "observations_update_own" ON public.observations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "observations_delete_own" ON public.observations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. BẢNG ACTIVITIES (Nhật ký hoạt động chung)
-- Calisthenics, chạy, cầu lông, đi bộ hoặc khác; phân biệt kế hoạch và thực tế
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('calisthenics', 'running', 'badminton', 'walking', 'other')),
    is_planned BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE: lịch dự kiến, FALSE: hoạt động thực tế đã diễn ra
    start_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    fatigue_level INTEGER CHECK (fatigue_level BETWEEN 1 AND 10), -- Mức độ mệt tùy chọn (1-10)
    notes TEXT, -- Dữ liệu người dùng tự nhập (không đáng tin)
    source TEXT NOT NULL DEFAULT 'manual_entry' CHECK (source IN ('manual_entry', 'session_sync')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select_own" ON public.activities
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "activities_insert_own" ON public.activities
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_update_own" ON public.activities
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_delete_own" ON public.activities
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 5. BẢNG PROGRAMS & SESSIONS (Giáo trình & Buổi tập Calisthenics minh họa)
-- Nội dung demo phải được gắn nhãn rõ ràng, không khẳng định đã qua kiểm chứng y khoa
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL nếu là chương trình hệ thống mẫu
    title TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0-demo',
    status TEXT NOT NULL DEFAULT 'demo_illustration' CHECK (status IN ('demo_illustration', 'reviewed', 'archived')),
    description TEXT NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT TRUE, -- Luôn gắn nhãn demo
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng đọc chương trình do mình tạo hoặc chương trình mẫu hệ thống (user_id IS NULL)
CREATE POLICY "programs_select" ON public.programs
    FOR SELECT TO authenticated
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "programs_insert_own" ON public.programs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "programs_update_own" ON public.programs
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "programs_delete_own" ON public.programs
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    exercises JSONB NOT NULL DEFAULT '[]'::jsonb, -- Danh sách động tác, hiệp, số lần
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON public.sessions
    FOR SELECT TO authenticated
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "sessions_insert_own" ON public.sessions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_own" ON public.sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON public.sessions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. BẢNG SESSION_RESULTS (Kết quả buổi tập calisthenics tự khai)
-- Có cơ chế chống ghi trùng (idempotency_key và unique index)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    self_reported_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Số hiệp/lần thực tế tự khai
    notes TEXT,
    idempotency_key TEXT, -- Chống bấm lưu lặp
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_session_user_completed UNIQUE (user_id, session_id, completed_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_results_idempotency 
    ON public.session_results(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_results_select_own" ON public.session_results
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "session_results_insert_own" ON public.session_results
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_results_update_own" ON public.session_results
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_results_delete_own" ON public.session_results
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. BẢNG REVIEW_SUGGESTIONS (Gợi ý xem lại lịch nhiều hoạt động)
-- Quy tắc tĩnh, gắn nhãn demo, không tự đổi tải hay kết luận phục hồi
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'dismissed', 'outdated')),
    reason TEXT NOT NULL,
    reference_activity_ids UUID[] NOT NULL DEFAULT '{}',
    rule_version TEXT NOT NULL DEFAULT 'rule-demo-v1.0',
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.review_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_suggestions_select_own" ON public.review_suggestions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "review_suggestions_insert_own" ON public.review_suggestions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_suggestions_update_own" ON public.review_suggestions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_suggestions_delete_own" ON public.review_suggestions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. BẢNG AI_CONSENTS (Sự đồng ý chia sẻ dữ liệu với AI)
-- Người dùng đồng ý phạm vi nào; khi rút lại (revoked_at != null) thì không gửi thêm
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_version TEXT NOT NULL DEFAULT 'v1.0-mvp',
    scope TEXT[] NOT NULL DEFAULT ARRAY['profile', 'goals', 'activities', 'observations']::TEXT[],
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_user_consent_version UNIQUE (user_id, consent_version)
);

ALTER TABLE public.ai_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_consents_select_own" ON public.ai_consents
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "ai_consents_insert_own" ON public.ai_consents
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_consents_update_own" ON public.ai_consents
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_consents_delete_own" ON public.ai_consents
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 9. BẢNG AI_SUMMARIES (Tóm tắt hồ sơ do AI hoặc template mẫu tạo)
-- Ảnh chụp dữ liệu tại thời điểm tạo; nêu rõ dữ liệu còn thiếu & tham chiếu bản ghi
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    input_scope JSONB NOT NULL DEFAULT '{}'::jsonb, -- Khoảng thời gian và nguồn đưa vào
    status TEXT NOT NULL DEFAULT 'ai_generated' CHECK (status IN ('ai_generated', 'template_fallback')),
    content TEXT NOT NULL,
    missing_data_notes TEXT, -- Nêu rõ dữ liệu chưa có (VD: chưa có cân nặng tuần này)
    reference_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Danh sách ID bản ghi tham chiếu
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_summaries_select_own" ON public.ai_summaries
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "ai_summaries_insert_own" ON public.ai_summaries
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_summaries_update_own" ON public.ai_summaries
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_summaries_delete_own" ON public.ai_summaries
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 10. BẢNG AI_CONVERSATIONS & AI_MESSAGES (Hỏi đáp AI theo hồ sơ)
-- Cho phép người dùng xem và xóa lịch sử; lưu nguồn tham chiếu cụ thể
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Hỏi đáp hồ sơ',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    reference_sources JSONB NOT NULL DEFAULT '[]'::jsonb, -- Bản ghi hoặc khoảng thời gian tham chiếu
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'retrying')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_select_own" ON public.ai_messages
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "ai_messages_insert_own" ON public.ai_messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_messages_update_own" ON public.ai_messages
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_messages_delete_own" ON public.ai_messages
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 11. TRIGGER CẬP NHẬT updated_at TỰ ĐỘNG
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_review_suggestions_updated_at
    BEFORE UPDATE ON public.review_suggestions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_ai_consents_updated_at
    BEFORE UPDATE ON public.ai_consents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_ai_conversations_updated_at
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
