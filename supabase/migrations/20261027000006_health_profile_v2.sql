-- ==============================================================================
-- CALISCOACHING - HỒ SƠ SỨC KHỎE CÁ NHÂN V2 MIGRATION
-- Bổ sung mô hình dữ liệu sức khỏe cá nhân:
-- 1. health_profiles: Năm sinh, bối cảnh công việc, múi giờ (1:1 auth.users)
-- 2. observations: Mở rộng loại chỉ số hỗ trợ 'waist_circumference'
-- 3. blood_pressure_readings: Huyết áp tâm thu/tâm trương theo lần đo
-- 4. daily_checkins: Ghi nhận sinh hoạt ngắn (ngủ, năng lượng, căng thẳng) theo ngày địa phương
-- 5. health_conditions: Tình trạng sức khỏe, chấn thương, triệu chứng tự khai
-- 6. allergies: Dị ứng tự khai (tác nhân, phản ứng, mức độ)
-- 7. medications: Thông tin thuốc người dùng tự khai
-- 8. health_events: Sự kiện khám bệnh, xét nghiệm, tiêm chủng
-- 9. health_documents: Metadata tài liệu y tế / phiếu khám liên kết sự kiện
-- ==============================================================================

-- 1. BẢNG HEALTH_PROFILES (Hồ sơ sức khỏe nền)
CREATE TABLE IF NOT EXISTS public.health_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    birth_year INTEGER CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= 2100)),
    work_context TEXT CHECK (work_context IS NULL OR work_context IN ('sedentary', 'standing_walking', 'physical_labor', 'other')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_profiles_select_own" ON public.health_profiles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "health_profiles_insert_own" ON public.health_profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_profiles_update_own" ON public.health_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_profiles_delete_own" ON public.health_profiles
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_health_profiles_updated_at
    BEFORE UPDATE ON public.health_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. MỞ RỘNG BẢNG OBSERVATIONS CHO CHỈ SỐ VÒNG EO (WAIST_CIRCUMFERENCE)
ALTER TABLE public.observations DROP CONSTRAINT IF EXISTS observations_metric_type_check;
ALTER TABLE public.observations ADD CONSTRAINT observations_metric_type_check 
    CHECK (metric_type IN ('weight', 'height', 'resting_heart_rate', 'body_feel', 'waist_circumference', 'other'));

-- 3. BẢNG BLOOD_PRESSURE_READINGS (Huyết áp hai thành phần)
CREATE TABLE IF NOT EXISTS public.blood_pressure_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    systolic INTEGER NOT NULL CHECK (systolic >= 40 AND systolic <= 300),
    diastolic INTEGER NOT NULL CHECK (diastolic >= 20 AND diastolic <= 200),
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'self_reported' CHECK (source IN ('self_reported', 'manual_import', 'imported_from_document')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blood_pressure_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blood_pressure_select_own" ON public.blood_pressure_readings
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "blood_pressure_insert_own" ON public.blood_pressure_readings
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blood_pressure_update_own" ON public.blood_pressure_readings
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blood_pressure_delete_own" ON public.blood_pressure_readings
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. BẢNG DAILY_CHECKINS (Ghi nhận sinh hoạt ngắn theo ngày địa phương)
CREATE TABLE IF NOT EXISTS public.daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_date DATE NOT NULL,
    sleep_start TIMESTAMPTZ,
    sleep_end TIMESTAMPTZ,
    sleep_duration_minutes INTEGER CHECK (sleep_duration_minutes IS NULL OR (sleep_duration_minutes >= 0 AND sleep_duration_minutes <= 1440)),
    sleep_quality INTEGER CHECK (sleep_quality IS NULL OR (sleep_quality >= 1 AND sleep_quality <= 5)),
    energy_level INTEGER CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 5)),
    stress_level INTEGER CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 5)),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_checkin_user_date UNIQUE (user_id, local_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_checkins_select_own" ON public.daily_checkins
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "daily_checkins_insert_own" ON public.daily_checkins
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_checkins_update_own" ON public.daily_checkins
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_checkins_delete_own" ON public.daily_checkins
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_daily_checkins_updated_at
    BEFORE UPDATE ON public.daily_checkins
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. BẢNG HEALTH_CONDITIONS (Tình trạng sức khỏe, chấn thương, triệu chứng tự khai)
CREATE TABLE IF NOT EXISTS public.health_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('diagnosed_condition', 'injury', 'self_reported_symptom')),
    started_at DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'monitoring')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_conditions_select_own" ON public.health_conditions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "health_conditions_insert_own" ON public.health_conditions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_conditions_update_own" ON public.health_conditions
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_conditions_delete_own" ON public.health_conditions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_health_conditions_updated_at
    BEFORE UPDATE ON public.health_conditions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. BẢNG ALLERGIES (Dị ứng tự khai)
CREATE TABLE IF NOT EXISTS public.allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    severity TEXT CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe')),
    status TEXT NOT NULL DEFAULT 'known' CHECK (status IN ('known', 'unknown_or_unrecorded')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allergies_select_own" ON public.allergies
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "allergies_insert_own" ON public.allergies
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allergies_update_own" ON public.allergies
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allergies_delete_own" ON public.allergies
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_allergies_updated_at
    BEFORE UPDATE ON public.allergies
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. BẢNG MEDICATIONS (Thuốc người dùng tự khai)
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage_instructions TEXT,
    started_at DATE,
    ended_at DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications_select_own" ON public.medications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "medications_insert_own" ON public.medications
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_update_own" ON public.medications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_delete_own" ON public.medications
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_medications_updated_at
    BEFORE UPDATE ON public.medications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. BẢNG HEALTH_EVENTS (Sự kiện khám bệnh, xét nghiệm, tiêm chủng)
CREATE TABLE IF NOT EXISTS public.health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('checkup', 'lab_test', 'vaccination', 'other')),
    event_date DATE NOT NULL,
    facility_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_events_select_own" ON public.health_events
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "health_events_insert_own" ON public.health_events
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_events_update_own" ON public.health_events
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_events_delete_own" ON public.health_events
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_health_events_updated_at
    BEFORE UPDATE ON public.health_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. BẢNG HEALTH_DOCUMENTS (Tài liệu sức khỏe, kết quả xét nghiệm, phiếu khám)
CREATE TABLE IF NOT EXISTS public.health_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.health_events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760), -- Tối đa 10MB
    storage_path TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_documents_select_own" ON public.health_documents
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "health_documents_insert_own" ON public.health_documents
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_documents_update_own" ON public.health_documents
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_documents_delete_own" ON public.health_documents
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_health_documents_updated_at
    BEFORE UPDATE ON public.health_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 10. THIẾT LẬP BUCKET STORAGE NẾU SCHEMA STORAGE TỒN TẠI
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'health_documents',
      'health_documents',
      false,
      10485760,
      ARRAY['application/pdf', 'image/jpeg', 'image/png']
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
