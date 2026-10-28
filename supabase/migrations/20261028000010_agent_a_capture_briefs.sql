-- ==============================================================================
-- AGENT A MIGRATION: D1 GHI NHANH (CAPTURE) & D2 HỒ SƠ TRAO ĐỔI (BRIEFS)
-- Version: 20261028000010
-- Quy ước điều phối:
-- 1. capture_idempotency_keys: Lưu idempotency key, hash payload và kết quả commit
-- 2. health_briefs: Lưu snapshot bất biến của brief, kèm source_fingerprints
-- 3. brief_shares: Lưu hash token chia sẻ, thời hạn expires_at và thu hồi revoked_at
-- 4. RPC commit_capture_batch: Thực hiện transaction nguyên tử cho hoạt động, checkin, chỉ số
-- ==============================================================================

-- 1. BẢNG CAPTURE_IDEMPOTENCY_KEYS
CREATE TABLE IF NOT EXISTS public.capture_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    committed_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_capture_idempotency UNIQUE(user_id, idempotency_key)
);

ALTER TABLE public.capture_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capture_idempotency_select_own" ON public.capture_idempotency_keys
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "capture_idempotency_insert_own" ON public.capture_idempotency_keys
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2. BẢNG HEALTH_BRIEFS (Lưu snapshot bất biến tóm tắt hồ sơ trao đổi)
CREATE TABLE IF NOT EXISTS public.health_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brief_type TEXT NOT NULL CHECK (brief_type IN ('workout', 'medical')),
    title TEXT NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    included_categories TEXT[] NOT NULL DEFAULT '{}',
    snapshot_payload JSONB NOT NULL,
    source_fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_notes TEXT,
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_briefs_select_own" ON public.health_briefs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "health_briefs_insert_own" ON public.health_briefs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_briefs_update_own" ON public.health_briefs
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "health_briefs_delete_own" ON public.health_briefs
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 3. BẢNG BRIEF_SHARES (Token hash chia sẻ snapshot có hạn và thu hồi)
CREATE TABLE IF NOT EXISTS public.brief_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID NOT NULL REFERENCES public.health_briefs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brief_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brief_shares_select_own" ON public.brief_shares
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "brief_shares_insert_own" ON public.brief_shares
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brief_shares_update_own" ON public.brief_shares
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brief_shares_delete_own" ON public.brief_shares
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 4. FUNCTION VÀ RPC COMMIT_CAPTURE_BATCH (Giao dịch nguyên tử)
CREATE OR REPLACE FUNCTION public.commit_capture_batch(
    p_idempotency_key TEXT,
    p_payload_hash TEXT,
    p_activities JSONB DEFAULT '[]'::jsonb,
    p_daily_checkin JSONB DEFAULT NULL,
    p_observations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_user_id UUID;
    v_existing_key RECORD;
    v_item JSONB;
    v_new_activity_id UUID;
    v_new_checkin_id UUID;
    v_new_obs_id UUID;
    v_created_records JSONB := '[]'::jsonb;
    v_activity_type TEXT;
    v_duration INT;
    v_fatigue INT;
    v_notes TEXT;
    v_start_at TIMESTAMPTZ;
    v_checkin_date DATE;
    v_sleep_start TIMESTAMPTZ;
    v_sleep_end TIMESTAMPTZ;
    v_sleep_dur INT;
    v_sleep_qual INT;
    v_energy INT;
    v_stress INT;
    v_action TEXT;
    v_metric_type TEXT;
    v_metric_val NUMERIC;
    v_metric_unit TEXT;
    v_obs_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Idempotency key is required';
    END IF;

    -- Kiểm tra idempotency key
    SELECT * INTO v_existing_key 
    FROM public.capture_idempotency_keys
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_existing_key.payload_hash = p_payload_hash THEN
            -- Replay kết quả trước đó
            RETURN jsonb_build_object(
                'status', 'replayed',
                'committed_records', v_existing_key.committed_records
            );
        ELSE
            -- Conflict: Cùng key nhưng khác payload
            RAISE EXCEPTION 'CONFLICT: Idempotency key % already used with different payload', p_idempotency_key;
        END IF;
    END IF;

    -- Ghi các Activity
    IF p_activities IS NOT NULL AND jsonb_array_length(p_activities) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_activities)
        LOOP
            v_activity_type := v_item->>'activity_type';
            v_duration := (v_item->>'duration_minutes')::INT;
            v_fatigue := (v_item->>'fatigue_level')::INT;
            v_notes := v_item->>'notes';
            v_start_at := (v_item->>'start_at')::TIMESTAMPTZ;

            IF v_duration IS NULL OR v_duration <= 0 THEN
                RAISE EXCEPTION 'INVALID_ACTIVITY: Duration must be greater than 0';
            END IF;

            INSERT INTO public.activities (
                user_id,
                activity_type,
                is_planned,
                start_at,
                duration_minutes,
                fatigue_level,
                notes,
                source
            ) VALUES (
                v_user_id,
                v_activity_type,
                FALSE,
                COALESCE(v_start_at, timezone('utc', now())),
                v_duration,
                v_fatigue,
                v_notes,
                'manual_entry'
            )
            RETURNING id INTO v_new_activity_id;

            v_created_records := v_created_records || jsonb_build_object(
                'source_type', 'activities',
                'id', v_new_activity_id,
                'activity_type', v_activity_type
            );
        END LOOP;
    END IF;

    -- Ghi Daily Checkin (nếu có)
    IF p_daily_checkin IS NOT NULL AND p_daily_checkin <> 'null'::jsonb THEN
        v_action := COALESCE(p_daily_checkin->>'action', 'create');
        v_checkin_date := (p_daily_checkin->>'local_date')::DATE;
        v_sleep_start := (p_daily_checkin->>'sleep_start')::TIMESTAMPTZ;
        v_sleep_end := (p_daily_checkin->>'sleep_end')::TIMESTAMPTZ;
        v_sleep_dur := (p_daily_checkin->>'sleep_duration_minutes')::INT;
        v_sleep_qual := (p_daily_checkin->>'sleep_quality')::INT;
        v_energy := (p_daily_checkin->>'energy_level')::INT;
        v_stress := (p_daily_checkin->>'stress_level')::INT;
        v_notes := p_daily_checkin->>'notes';

        IF v_checkin_date IS NULL THEN
            RAISE EXCEPTION 'INVALID_CHECKIN: local_date is required';
        END IF;

        IF v_action = 'create' THEN
            INSERT INTO public.daily_checkins (
                user_id,
                local_date,
                sleep_start,
                sleep_end,
                sleep_duration_minutes,
                sleep_quality,
                energy_level,
                stress_level,
                notes
            ) VALUES (
                v_user_id,
                v_checkin_date,
                v_sleep_start,
                v_sleep_end,
                v_sleep_dur,
                v_sleep_qual,
                v_energy,
                v_stress,
                v_notes
            )
            RETURNING id INTO v_new_checkin_id;

            v_created_records := v_created_records || jsonb_build_object(
                'source_type', 'daily_checkins',
                'id', v_new_checkin_id,
                'local_date', v_checkin_date,
                'action', 'created'
            );
        ELSIF v_action = 'update' THEN
            UPDATE public.daily_checkins
            SET
                sleep_start = COALESCE(v_sleep_start, sleep_start),
                sleep_end = COALESCE(v_sleep_end, sleep_end),
                sleep_duration_minutes = COALESCE(v_sleep_dur, sleep_duration_minutes),
                sleep_quality = COALESCE(v_sleep_qual, sleep_quality),
                energy_level = COALESCE(v_energy, energy_level),
                stress_level = COALESCE(v_stress, stress_level),
                notes = COALESCE(v_notes, notes),
                updated_at = timezone('utc', now())
            WHERE user_id = v_user_id AND local_date = v_checkin_date
            RETURNING id INTO v_new_checkin_id;

            IF v_new_checkin_id IS NULL THEN
                -- Nếu chưa có để update thì insert mới
                INSERT INTO public.daily_checkins (
                    user_id,
                    local_date,
                    sleep_start,
                    sleep_end,
                    sleep_duration_minutes,
                    sleep_quality,
                    energy_level,
                    stress_level,
                    notes
                ) VALUES (
                    v_user_id,
                    v_checkin_date,
                    v_sleep_start,
                    v_sleep_end,
                    v_sleep_dur,
                    v_sleep_qual,
                    v_energy,
                    v_stress,
                    v_notes
                )
                RETURNING id INTO v_new_checkin_id;
            END IF;

            v_created_records := v_created_records || jsonb_build_object(
                'source_type', 'daily_checkins',
                'id', v_new_checkin_id,
                'local_date', v_checkin_date,
                'action', 'updated'
            );
        -- ELSIF v_action = 'skip' thì không làm gì
        END IF;
    END IF;

    -- Ghi Observations (nếu có)
    IF p_observations IS NOT NULL AND jsonb_array_length(p_observations) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_observations)
        LOOP
            v_metric_type := v_item->>'metric_type';
            v_metric_val := (v_item->>'metric_value')::NUMERIC;
            v_metric_unit := v_item->>'metric_unit';
            v_obs_at := (v_item->>'observed_at')::TIMESTAMPTZ;
            v_notes := v_item->>'notes';

            IF v_metric_val IS NULL OR v_metric_val <= 0 THEN
                RAISE EXCEPTION 'INVALID_OBSERVATION: metric_value must be greater than 0';
            END IF;

            INSERT INTO public.observations (
                user_id,
                metric_type,
                metric_value,
                metric_unit,
                observed_at,
                source,
                notes
            ) VALUES (
                v_user_id,
                v_metric_type,
                v_metric_val,
                COALESCE(v_metric_unit, 'kg'),
                COALESCE(v_obs_at, timezone('utc', now())),
                'self_reported',
                v_notes
            )
            RETURNING id INTO v_new_obs_id;

            v_created_records := v_created_records || jsonb_build_object(
                'source_type', 'observations',
                'id', v_new_obs_id,
                'metric_type', v_metric_type
            );
        END LOOP;
    END IF;

    -- Lưu Idempotency Key
    INSERT INTO public.capture_idempotency_keys (
        user_id,
        idempotency_key,
        payload_hash,
        committed_records
    ) VALUES (
        v_user_id,
        p_idempotency_key,
        p_payload_hash,
        v_created_records
    );

    RETURN jsonb_build_object(
        'status', 'committed',
        'committed_records', v_created_records
    );
END;
$$;
