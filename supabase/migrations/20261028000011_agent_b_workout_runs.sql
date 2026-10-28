-- ==============================================================================
-- AGENT B MIGRATION: D3 TIẾP TỤC TẬP CÓ TRÍ NHỚ (WORKOUT RUNS & SETS)
-- Version: 20261028000020
-- ==============================================================================
-- 1. workout_runs: Quản lý phiên tập, trạng thái (in_progress, paused, completed, abandoned),
--    snapshot bài tập bất biến, tổng thời gian tạm dừng và concurrency version.
-- 2. workout_sets: Quản lý từng hiệp tập, tách biệt target và actual, idempotency_key.
-- 3. RPCs:
--    - pause_workout_run: Tạm dừng phiên tập, đóng băng thời gian
--    - resume_workout_run: Tiếp tục tập, cộng dồn paused duration
--    - record_workout_set: Lưu từng hiệp với idempotency và kiểm tra trạng thái run
--    - abandon_workout_run: Hủy bỏ phiên tập (không tạo activity hay session result)
--    - finalize_workout_run: Hoàn thành phiên tập nguyên tử (run + session_results + activities)
-- ==============================================================================

-- 1. BẢNG WORKOUT_RUNS
CREATE TABLE IF NOT EXISTS public.workout_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    program_version TEXT NOT NULL DEFAULT '1.0.0-demo',
    session_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paused_at TIMESTAMPTZ,
    total_paused_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_paused_duration_seconds >= 0),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 86400)),
    perceived_exertion_1_10 INTEGER CHECK (perceived_exertion_1_10 IS NULL OR (perceived_exertion_1_10 BETWEEN 1 AND 10)),
    notes TEXT,
    exercises_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_run_paused_state CHECK (
        (status = 'paused' AND paused_at IS NOT NULL) OR
        (status <> 'paused')
    ),
    CONSTRAINT chk_run_completed_state CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status <> 'completed')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_runs_idempotency
    ON public.workout_runs(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_runs_user_status
    ON public.workout_runs(user_id, status);

ALTER TABLE public.workout_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_runs_select_own" ON public.workout_runs;
CREATE POLICY "workout_runs_select_own" ON public.workout_runs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_runs_insert_own" ON public.workout_runs;
CREATE POLICY "workout_runs_insert_own" ON public.workout_runs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_runs_update_own" ON public.workout_runs;
CREATE POLICY "workout_runs_update_own" ON public.workout_runs
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_runs_delete_own" ON public.workout_runs;
CREATE POLICY "workout_runs_delete_own" ON public.workout_runs
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 2. BẢNG WORKOUT_SETS
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.workout_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_index INTEGER NOT NULL CHECK (exercise_index >= 0),
    exercise_name TEXT NOT NULL,
    exercise_variant TEXT,
    set_order INTEGER NOT NULL CHECK (set_order >= 1),
    target_reps TEXT NOT NULL,
    target_load NUMERIC CHECK (target_load IS NULL OR target_load >= 0),
    target_duration_seconds INTEGER CHECK (target_duration_seconds IS NULL OR target_duration_seconds >= 0),
    target_assistance TEXT,
    target_unit TEXT NOT NULL DEFAULT 'reps',
    actual_reps INTEGER CHECK (actual_reps IS NULL OR (actual_reps >= 0 AND actual_reps <= 1000)),
    actual_load NUMERIC CHECK (actual_load IS NULL OR (actual_load >= 0 AND actual_load <= 1000)),
    actual_duration_seconds INTEGER CHECK (actual_duration_seconds IS NULL OR (actual_duration_seconds >= 0 AND actual_duration_seconds <= 86400)),
    actual_unit TEXT NOT NULL DEFAULT 'reps',
    actual_assistance TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    idempotency_key TEXT NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workout_sets_run_exercise_order UNIQUE (user_id, run_id, exercise_index, set_order)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sets_idempotency
    ON public.workout_sets(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_workout_sets_user_exercise
    ON public.workout_sets(user_id, exercise_name);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_sets_select_own" ON public.workout_sets;
CREATE POLICY "workout_sets_select_own" ON public.workout_sets
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_sets_insert_own" ON public.workout_sets;
CREATE POLICY "workout_sets_insert_own" ON public.workout_sets
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_sets_update_own" ON public.workout_sets;
CREATE POLICY "workout_sets_update_own" ON public.workout_sets
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "workout_sets_delete_own" ON public.workout_sets;
CREATE POLICY "workout_sets_delete_own" ON public.workout_sets
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 3. RPC: RECORD_WORKOUT_SET (Lưu từng hiệp với kiểm tra ownership & run state)
CREATE OR REPLACE FUNCTION public.record_workout_set(
    p_run_id UUID,
    p_exercise_index INTEGER,
    p_exercise_name TEXT,
    p_exercise_variant TEXT,
    p_set_order INTEGER,
    p_target_reps TEXT,
    p_target_load NUMERIC,
    p_target_duration_seconds INTEGER,
    p_target_assistance TEXT,
    p_target_unit TEXT,
    p_actual_reps INTEGER,
    p_actual_load NUMERIC,
    p_actual_duration_seconds INTEGER,
    p_actual_unit TEXT,
    p_actual_assistance TEXT,
    p_status TEXT,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_run RECORD;
    v_set_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    -- Kiểm tra run tồn tại, thuộc user và đang active/paused
    SELECT id, status, version INTO v_run
    FROM public.workout_runs
    WHERE id = p_run_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Workout run does not exist or access denied';
    END IF;

    IF v_run.status NOT IN ('in_progress', 'paused') THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot record sets for a % run', v_run.status;
    END IF;

    -- Upsert hiệp tập theo (user_id, run_id, exercise_index, set_order)
    INSERT INTO public.workout_sets (
        user_id,
        run_id,
        exercise_index,
        exercise_name,
        exercise_variant,
        set_order,
        target_reps,
        target_load,
        target_duration_seconds,
        target_assistance,
        target_unit,
        actual_reps,
        actual_load,
        actual_duration_seconds,
        actual_unit,
        actual_assistance,
        status,
        idempotency_key,
        completed_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_run_id,
        p_exercise_index,
        p_exercise_name,
        p_exercise_variant,
        p_set_order,
        p_target_reps,
        p_target_load,
        p_target_duration_seconds,
        p_target_assistance,
        COALESCE(p_target_unit, 'reps'),
        p_actual_reps,
        p_actual_load,
        p_actual_duration_seconds,
        COALESCE(p_actual_unit, 'reps'),
        p_actual_assistance,
        COALESCE(p_status, 'completed'),
        p_idempotency_key,
        CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT (user_id, run_id, exercise_index, set_order)
    DO UPDATE SET
        actual_reps = EXCLUDED.actual_reps,
        actual_load = EXCLUDED.actual_load,
        actual_duration_seconds = EXCLUDED.actual_duration_seconds,
        actual_unit = EXCLUDED.actual_unit,
        actual_assistance = EXCLUDED.actual_assistance,
        status = EXCLUDED.status,
        idempotency_key = EXCLUDED.idempotency_key,
        completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN now() ELSE public.workout_sets.completed_at END,
        updated_at = now()
    RETURNING id INTO v_set_id;

    RETURN jsonb_build_object(
        'success', true,
        'set_id', v_set_id,
        'run_id', p_run_id,
        'status', p_status
    );
END;
$$;

-- 4. RPC: PAUSE_WORKOUT_RUN
CREATE OR REPLACE FUNCTION public.pause_workout_run(
    p_run_id UUID,
    p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_run RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    SELECT id, status, version INTO v_run
    FROM public.workout_runs
    WHERE id = p_run_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Workout run not found';
    END IF;

    IF p_expected_version IS NOT NULL AND v_run.version <> p_expected_version THEN
        RAISE EXCEPTION 'CONCURRENCY_ERROR: Version mismatch (expected %, found %)', p_expected_version, v_run.version;
    END IF;

    IF v_run.status = 'paused' THEN
        -- Đã tạm dừng rồi -> trả về thành công (idempotent)
        RETURN jsonb_build_object('success', true, 'status', 'paused', 'version', v_run.version);
    END IF;

    IF v_run.status <> 'in_progress' THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot pause a run in status %', v_run.status;
    END IF;

    UPDATE public.workout_runs
    SET
        status = 'paused',
        paused_at = now(),
        version = version + 1,
        updated_at = now()
    WHERE id = p_run_id;

    RETURN jsonb_build_object('success', true, 'status', 'paused', 'version', v_run.version + 1);
END;
$$;

-- 5. RPC: RESUME_WORKOUT_RUN
CREATE OR REPLACE FUNCTION public.resume_workout_run(
    p_run_id UUID,
    p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_run RECORD;
    v_paused_diff INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    SELECT id, status, version, paused_at, total_paused_duration_seconds INTO v_run
    FROM public.workout_runs
    WHERE id = p_run_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Workout run not found';
    END IF;

    IF p_expected_version IS NOT NULL AND v_run.version <> p_expected_version THEN
        RAISE EXCEPTION 'CONCURRENCY_ERROR: Version mismatch (expected %, found %)', p_expected_version, v_run.version;
    END IF;

    IF v_run.status = 'in_progress' THEN
        -- Đang chạy rồi -> idempotent
        RETURN jsonb_build_object('success', true, 'status', 'in_progress', 'version', v_run.version);
    END IF;

    IF v_run.status <> 'paused' THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot resume a run in status %', v_run.status;
    END IF;

    v_paused_diff := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_run.paused_at))::int);

    UPDATE public.workout_runs
    SET
        status = 'in_progress',
        paused_at = NULL,
        total_paused_duration_seconds = total_paused_duration_seconds + v_paused_diff,
        version = version + 1,
        updated_at = now()
    WHERE id = p_run_id;

    RETURN jsonb_build_object('success', true, 'status', 'in_progress', 'version', v_run.version + 1);
END;
$$;

-- 6. RPC: ABANDON_WORKOUT_RUN (Hủy phiên tập - không tạo kết quả hay hoạt động)
CREATE OR REPLACE FUNCTION public.abandon_workout_run(
    p_run_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_run RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    SELECT id, status, version INTO v_run
    FROM public.workout_runs
    WHERE id = p_run_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Workout run not found';
    END IF;

    IF v_run.status = 'abandoned' THEN
        RETURN jsonb_build_object('success', true, 'status', 'abandoned');
    END IF;

    IF v_run.status = 'completed' THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot abandon a completed workout run';
    END IF;

    UPDATE public.workout_runs
    SET
        status = 'abandoned',
        paused_at = NULL,
        updated_at = now()
    WHERE id = p_run_id;

    RETURN jsonb_build_object('success', true, 'status', 'abandoned');
END;
$$;

-- 7. RPC: FINALIZE_WORKOUT_RUN (Hoàn thành nguyên tử: Run + Session Results + Activities)
CREATE OR REPLACE FUNCTION public.finalize_workout_run(
    p_run_id UUID,
    p_expected_version INTEGER,
    p_perceived_exertion INTEGER,
    p_notes TEXT,
    p_idempotency_key TEXT,
    p_allow_partial BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_run RECORD;
    v_paused_diff INTEGER := 0;
    v_total_paused INTEGER;
    v_elapsed_seconds INTEGER;
    v_duration_minutes INTEGER;
    v_incomplete_count INTEGER;
    v_completed_exercises JSONB;
    v_result_id UUID;
    v_activity_id UUID;
    v_clean_notes TEXT;
    v_activity_notes TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
    END IF;

    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Idempotency key is required';
    END IF;

    IF p_perceived_exertion IS NOT NULL AND (p_perceived_exertion < 1 OR p_perceived_exertion > 10) THEN
        RAISE EXCEPTION 'INVALID_ARGUMENT: Perceived exertion must be between 1 and 10';
    END IF;

    -- Khóa hàng run để đảm bảo tính tuần tự
    SELECT * INTO v_run
    FROM public.workout_runs
    WHERE id = p_run_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Workout run not found or access denied';
    END IF;

    -- Idempotency check: nếu run này đã hoàn thành với cùng idempotency_key
    IF v_run.status = 'completed' THEN
        IF v_run.idempotency_key = p_idempotency_key THEN
            RETURN jsonb_build_object(
                'success', true,
                'run_id', p_run_id,
                'status', 'completed',
                'idempotent_replay', true,
                'duration_seconds', v_run.duration_seconds,
                'duration_minutes', GREATEST(1, ROUND(COALESCE(v_run.duration_seconds, 60) / 60.0)::int)
            );
        ELSE
            RAISE EXCEPTION 'CONFLICT: Workout run is already completed with a different key';
        END IF;
    END IF;

    IF v_run.status = 'abandoned' THEN
        RAISE EXCEPTION 'INVALID_STATE: Cannot finalize an abandoned run';
    END IF;

    -- Kiểm tra optimistic locking
    IF p_expected_version IS NOT NULL AND v_run.version <> p_expected_version THEN
        RAISE EXCEPTION 'CONCURRENCY_ERROR: Version mismatch (expected %, found %)', p_expected_version, v_run.version;
    END IF;

    -- Kiểm tra các hiệp chưa hoàn thành
    SELECT COUNT(*)::int INTO v_incomplete_count
    FROM public.workout_sets
    WHERE run_id = p_run_id AND (status = 'pending' OR actual_reps IS NULL);

    IF v_incomplete_count > 0 THEN
        IF NOT p_allow_partial THEN
            RAISE EXCEPTION 'INCOMPLETE_SETS: % uncompleted sets remain. Partial completion not allowed.', v_incomplete_count;
        ELSE
            -- Đánh dấu các hiệp chưa tập là 'skipped'
            UPDATE public.workout_sets
            SET status = 'skipped', updated_at = now()
            WHERE run_id = p_run_id AND (status = 'pending' OR actual_reps IS NULL);
        END IF;
    END IF;

    -- Tính thời gian thực tế đã tập
    v_total_paused := v_run.total_paused_duration_seconds;
    IF v_run.status = 'paused' AND v_run.paused_at IS NOT NULL THEN
        v_paused_diff := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_run.paused_at))::int);
        v_total_paused := v_total_paused + v_paused_diff;
    END IF;

    v_elapsed_seconds := GREATEST(1, EXTRACT(EPOCH FROM (now() - v_run.started_at))::int - v_total_paused);
    -- Giới hạn an toàn tối đa 24h (86400s)
    v_elapsed_seconds := LEAST(86400, v_elapsed_seconds);
    v_duration_minutes := GREATEST(1, ROUND(v_elapsed_seconds / 60.0)::int);

    v_clean_notes := NULLIF(trim(COALESCE(p_notes, '')), '');

    -- 1. Cập nhật workout_runs
    UPDATE public.workout_runs
    SET
        status = 'completed',
        completed_at = now(),
        paused_at = NULL,
        total_paused_duration_seconds = v_total_paused,
        duration_seconds = v_elapsed_seconds,
        perceived_exertion_1_10 = p_perceived_exertion,
        notes = v_clean_notes,
        idempotency_key = p_idempotency_key,
        version = version + 1,
        updated_at = now()
    WHERE id = p_run_id;

    -- 2. Tập hợp các động tác đã hoàn thành thật (actual_reps > 0)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'exercise_name', s.exercise_name,
                'actual_sets', s.sets_count,
                'actual_reps', s.reps_summary
            )
        ),
        '[]'::jsonb
    ) INTO v_completed_exercises
    FROM (
        SELECT
            exercise_name,
            COUNT(*)::int AS sets_count,
            string_agg(actual_reps::text, ', ' ORDER BY set_order) AS reps_summary
        FROM public.workout_sets
        WHERE run_id = p_run_id AND status = 'completed' AND actual_reps IS NOT NULL AND actual_reps > 0
        GROUP BY exercise_name
    ) s;

    -- 3. Lưu vào session_results (nếu có session_id)
    IF v_run.session_id IS NOT NULL THEN
        INSERT INTO public.session_results (
            session_id,
            user_id,
            completed_at,
            self_reported_data,
            notes,
            idempotency_key,
            is_demo
        ) VALUES (
            v_run.session_id,
            v_user_id,
            now(),
            jsonb_build_object(
                'completed_exercises', v_completed_exercises,
                'perceived_exertion_1_10', p_perceived_exertion,
                'is_partial', (v_incomplete_count > 0)
            ),
            v_clean_notes,
            p_idempotency_key,
            v_run.is_demo
        )
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING id INTO v_result_id;
    END IF;

    -- 4. Lưu vào activities (đồng bộ nền)
    v_activity_notes := CASE
        WHEN v_clean_notes IS NOT NULL THEN 'Buổi tập: ' || v_run.session_title || ' • ' || v_clean_notes
        ELSE 'Buổi tập: ' || v_run.session_title
    END;

    INSERT INTO public.activities (
        user_id,
        activity_type,
        is_planned,
        start_at,
        duration_minutes,
        fatigue_level,
        notes,
        source,
        idempotency_key
    ) VALUES (
        v_user_id,
        'calisthenics',
        false,
        v_run.started_at,
        v_duration_minutes,
        p_perceived_exertion,
        v_activity_notes,
        'session_sync',
        p_idempotency_key
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_activity_id;

    RETURN jsonb_build_object(
        'success', true,
        'run_id', p_run_id,
        'status', 'completed',
        'duration_seconds', v_elapsed_seconds,
        'duration_minutes', v_duration_minutes,
        'is_partial', (v_incomplete_count > 0),
        'completed_exercises_count', jsonb_array_length(v_completed_exercises),
        'session_result_id', v_result_id,
        'activity_id', v_activity_id
    );
END;
$$;
