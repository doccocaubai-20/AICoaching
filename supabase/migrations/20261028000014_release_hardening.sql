-- Forward upgrade: protect linked ownership, upload accounting, and existing installations.
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
    v_act_idx INT := 0;
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
            v_act_idx := v_act_idx + 1;
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
                source,
                idempotency_key
            ) VALUES (
                v_user_id,
                v_activity_type,
                FALSE,
                COALESCE(v_start_at, timezone('utc', now())),
                v_duration,
                v_fatigue,
                v_notes,
                'manual_entry',
                p_idempotency_key || ':act:' || v_act_idx
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
ALTER TABLE public.observations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_observations_updated_at ON public.observations;
CREATE TRIGGER trg_observations_updated_at BEFORE UPDATE ON public.observations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE OR REPLACE FUNCTION public.enforce_brief_share_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.health_briefs b WHERE b.id=NEW.brief_id AND b.user_id=NEW.user_id) THEN
   RAISE EXCEPTION 'Share and brief must have the same owner' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_brief_share_owner ON public.brief_shares;
CREATE TRIGGER trg_brief_share_owner BEFORE INSERT OR UPDATE ON public.brief_shares
FOR EACH ROW EXECUTE FUNCTION public.enforce_brief_share_owner();


-- Public data is built from an explicit allowlist, including nested objects.
CREATE OR REPLACE FUNCTION public.brief_pick_fields(p jsonb, fields text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
 FROM jsonb_each(coalesce(p,'{}'::jsonb)) WHERE key=ANY(fields);
$$;
CREATE OR REPLACE FUNCTION public.brief_public_snapshot(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result jsonb; details jsonb; key_name text; fields text[];
BEGIN
 result=jsonb_build_object(
   'meta', public.brief_pick_fields(p->'meta',ARRAY['briefType','title','generatedAt','timezone','disclaimer']) ||
     jsonb_build_object('dateRange',public.brief_pick_fields(p#>'{meta,dateRange}',ARRAY['start','end'])),
   'overview',public.brief_pick_fields(p->'overview',ARRAY['totalRecords','daysWithRecords','missingDaysCount','activitySessionCount','totalActivityMinutes','averageSleepMinutes']),
   'missingDataNotes',coalesce(p->'missingDataNotes','[]'::jsonb),'sourceRefs','[]'::jsonb);
 IF p ? 'workoutDetails' THEN
   details=public.brief_pick_fields(p->'workoutDetails',ARRAY['activitiesCountByType','notesAndDifficulties']);
   details=details || jsonb_build_object('sessions',(SELECT coalesce(jsonb_agg(public.brief_pick_fields(value,ARRAY['date','activityType','durationMinutes','fatigueLevel','notes'])),'[]'::jsonb) FROM jsonb_array_elements(coalesce(p#>'{workoutDetails,sessions}','[]'::jsonb))));
   result=result || jsonb_build_object('workoutDetails',details);
 END IF;
 IF p ? 'medicalDetails' THEN
   details='{}'::jsonb;
   FOR key_name,fields IN SELECT * FROM (VALUES
     ('selfReportedConditions',ARRAY['conditionName','status','notes']),
     ('allergies',ARRAY['allergen','reaction','severity']),
     ('medications',ARRAY['medicationName','dosage','frequency']),
     ('vitalObservations',ARRAY['metricType','metricValue','metricUnit','observedAt']),
     ('dailyCheckinTrends',ARRAY['date','sleepDurationMinutes','sleepQuality','energyLevel','stressLevel'])
   ) AS allowlist(name,allowed_fields) LOOP
     IF p->'medicalDetails' ? key_name THEN
       details=details || jsonb_build_object(key_name,(SELECT coalesce(jsonb_agg(public.brief_pick_fields(value,fields)),'[]'::jsonb) FROM jsonb_array_elements(p->'medicalDetails'->key_name)));
     END IF;
   END LOOP;
   result=result || jsonb_build_object('medicalDetails',details);
 END IF;
 RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_shared_brief(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_share RECORD;
    v_brief RECORD;
    v_ref JSONB;
    v_source_type TEXT;
    v_source_id UUID;
    v_current_ts TIMESTAMPTZ;
BEGIN
    IF p_token_hash IS NULL OR length(trim(p_token_hash)) < 16 THEN
        RETURN jsonb_build_object('status', 'not_found', 'message', 'Mã liên kết không hợp lệ.');
    END IF;

    -- Tìm bản ghi share khớp token_hash
    SELECT id, brief_id, user_id, expires_at, revoked_at, access_count, last_accessed_at, created_at
    INTO v_share
    FROM public.brief_shares
    WHERE token_hash = trim(p_token_hash)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found', 'message', 'Không tìm thấy liên kết chia sẻ hoặc liên kết đã bị xóa.');
    END IF;

    -- Kiểm tra Thu hồi (Revoked)
    IF v_share.revoked_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'revoked', 'message', 'Chủ sở hữu đã thu hồi quyền truy cập của liên kết này.');
    END IF;

    -- Kiểm tra Hết hạn (Expired)
    IF v_share.expires_at < timezone('utc', now()) THEN
        RETURN jsonb_build_object('status', 'expired', 'message', 'Liên kết chia sẻ này đã hết thời hạn sử dụng.');
    END IF;

    -- Lấy thông tin health_briefs tương ứng
    SELECT id, user_id, brief_type, title, date_range_start, date_range_end, snapshot_payload, source_fingerprints, user_notes, ai_summary, created_at
    INTO v_brief
    FROM public.health_briefs
    WHERE id = v_share.brief_id AND user_id = v_share.user_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found', 'message', 'Không tìm thấy bản tóm tắt liên kết.');
    END IF;

    -- Stale Detection (V3): Kiểm tra toàn bộ nguồn dữ liệu được lưu trong source_fingerprints
    IF v_brief.source_fingerprints IS NOT NULL AND jsonb_array_length(v_brief.source_fingerprints) > 0 THEN
        FOR v_ref IN SELECT * FROM jsonb_array_elements(v_brief.source_fingerprints)
        LOOP
            v_source_type := v_ref->>'sourceType';
            v_source_id := (v_ref->>'sourceId')::uuid;
            v_current_ts := NULL;

            IF v_source_type = 'activities' THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.activities WHERE id = v_source_id AND user_id = v_brief.user_id;
            ELSIF v_source_type = 'daily_checkins' THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.daily_checkins WHERE id = v_source_id AND user_id = v_brief.user_id;
            ELSIF v_source_type = 'observations' THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.observations WHERE id = v_source_id AND user_id = v_brief.user_id;
            ELSIF v_source_type IN ('conditions', 'health_conditions') THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.health_conditions WHERE id = v_source_id AND user_id = v_brief.user_id;
            ELSIF v_source_type = 'medications' THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.medications WHERE id = v_source_id AND user_id = v_brief.user_id;
            ELSIF v_source_type = 'allergies' THEN
                SELECT coalesce(updated_at, created_at) INTO v_current_ts
                FROM public.allergies WHERE id = v_source_id AND user_id = v_brief.user_id;
            END IF;

            -- Nếu bản ghi nguồn đã bị xóa hoặc không thuộc về người dùng
            IF v_current_ts IS NULL THEN
                RETURN jsonb_build_object(
                    'status', 'stale',
                    'message', 'Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã bị thay đổi hoặc xóa bởi chủ sở hữu.',
                    'stale_details', jsonb_build_object(
                        'stale_source_count', 1,
                        'message', 'Bản ghi nguồn (' || v_source_type || ') không còn tồn tại.'
                    )
                );
            END IF;

            -- Nếu bản ghi nguồn đã bị sửa sau khi brief snapshot được tạo
            IF (v_ref ? 'sourceUpdatedAt' AND v_current_ts IS DISTINCT FROM (v_ref->>'sourceUpdatedAt')::timestamptz) OR (NOT (v_ref ? 'sourceUpdatedAt') AND v_current_ts > v_brief.created_at) THEN
                RETURN jsonb_build_object(
                    'status', 'stale',
                    'message', 'Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã được cập nhật bởi chủ sở hữu.',
                    'stale_details', jsonb_build_object(
                        'stale_source_count', 1,
                        'message', 'Nội dung dữ liệu nguồn (' || v_source_type || ') đã được cập nhật sau khi tạo bản tóm tắt.'
                    )
                );
            END IF;
        END LOOP;
    END IF;

    -- Cập nhật số lượt truy cập và thời điểm truy cập gần nhất
    UPDATE public.brief_shares
    SET access_count = access_count + 1,
        last_accessed_at = timezone('utc', now())
    WHERE id = v_share.id;

    -- Trả về dữ liệu an toàn (CHỈ SNAPSHOT ĐÃ ALLOWLIST, KHÔNG LỘ RAW ENTITIES CỦA USER KHÁC)
    RETURN jsonb_build_object(
        'status', 'active',
        'brief_type', v_brief.brief_type,
        'title', v_brief.title,
        'date_range_start', v_brief.date_range_start,
        'date_range_end', v_brief.date_range_end,
        'snapshot', public.brief_public_snapshot(v_brief.snapshot_payload),
        'user_notes', v_brief.user_notes,
        'ai_summary', v_brief.ai_summary,
        'expires_at', v_share.expires_at,
        'created_at', v_share.created_at
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_shared_brief(TEXT) TO anon, authenticated;
DROP POLICY IF EXISTS group_members_update_self_mute ON public.group_members;
CREATE POLICY group_members_update_self_mute ON public.group_members FOR UPDATE TO authenticated
USING (auth.uid()=user_id AND status='active') WITH CHECK (auth.uid()=user_id AND status='active');
CREATE OR REPLACE FUNCTION public.protect_group_member_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Cho phép cập nhật qua các RPC quản trị được kiểm soát
  IF current_setting('app.allow_group_member_mutation', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NEW.id != OLD.id OR NEW.group_id != OLD.group_id OR NEW.user_id != OLD.user_id OR NEW.role != OLD.role OR NEW.status != OLD.status OR NEW.joined_at != OLD.joined_at THEN
      RAISE EXCEPTION 'Chỉ được phép cập nhật cài đặt thông báo (is_muted), không được sửa thông tin thành viên trực tiếp' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_group_member_fields ON public.group_members;
CREATE TRIGGER trg_protect_group_member_fields BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.protect_group_member_fields();

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
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
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
  IF v_current_role IS NULL OR v_current_role != 'owner' THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm hiện tại mới có quyền chuyển giao quyền sở hữu nhóm' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_active_group_member(p_group_id, p_new_owner_id) THEN
    RAISE EXCEPTION 'Người nhận quyền phải là thành viên đang hoạt động trong nhóm' USING ERRCODE = '22023';
  END IF;

  IF v_user_id = p_new_owner_id THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_group_member_mutation', 'true', true);

  UPDATE public.group_members
  SET role = 'admin'
  WHERE group_id = p_group_id AND user_id = v_user_id;

  UPDATE public.group_members
  SET role = 'owner'
  WHERE group_id = p_group_id AND user_id = p_new_owner_id;

  RETURN TRUE;
END;
$$;
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
  IF v_current_role IS NULL OR v_current_role != 'owner' THEN
    RAISE EXCEPTION 'Chỉ chủ nhóm mới có quyền giải tán/lưu trữ nhóm' USING ERRCODE = '42501';
  END IF;

  UPDATE public.groups
  SET status = 'archived', updated_at = now()
  WHERE id = p_group_id;

  RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.protect_journey_video_accounting()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
    IF current_user IN ('anon','authenticated') AND
      (to_jsonb(NEW)-'timestamp_notes'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'timestamp_notes'-'updated_at') THEN
        RAISE EXCEPTION 'Video accounting changes require a controlled operation' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_journey_video_metadata ON public.journey_videos;
CREATE TRIGGER trg_protect_journey_video_metadata BEFORE UPDATE ON public.journey_videos
FOR EACH ROW EXECUTE FUNCTION public.protect_journey_video_accounting();
DROP POLICY IF EXISTS journey_videos_insert_own ON public.journey_videos;
DROP POLICY IF EXISTS journey_videos_delete_own ON public.journey_videos;
-- Grant upload only through the authenticated server reservation action.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
   DROP POLICY IF EXISTS comparison_videos_owner_insert ON storage.objects;
   DROP POLICY IF EXISTS comparison_videos_owner_update ON storage.objects;
   DROP POLICY IF EXISTS comparison_videos_owner_delete ON storage.objects;
 END IF;
END $$;

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
                UPDATE public.journey_videos SET expires_at=now()+interval '130 minutes' WHERE id=v_existing_id;
                RETURN v_existing_id;
            END IF;
        END IF;
    END IF;

    -- Tính tổng dung lượng hiện tại đã cam kết (ready) + các lượt giữ chỗ còn hiệu lực (reserved)
    SELECT COALESCE(SUM(CASE WHEN v.expires_at > now() THEN 20971520
      ELSE greatest(v.file_size_bytes,coalesce((SELECT (o.metadata->>'size')::bigint FROM storage.objects o
        WHERE o.bucket_id='comparison_videos' AND o.name=v.storage_path LIMIT 1),0)) END), 0)
    INTO v_used_bytes
    FROM public.journey_videos v
    WHERE v.user_id = v_user_id AND (v.status <> 'deleted' OR v.expires_at > now()
      OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='comparison_videos' AND o.name=v.storage_path));

    -- Hạn mức tối đa 100 MiB (104,857,600 bytes)
    IF v_used_bytes + 20971520 > 104857600 THEN
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
        now() + INTERVAL '130 minutes'
    ) RETURNING id INTO v_video_id;

    RETURN v_video_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.finalize_journey_video_upload(
    p_video_id UUID, p_actual_size_bytes INTEGER, p_actual_mime_type TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_user UUID := auth.uid();
    v_row public.journey_videos%ROWTYPE;
    v_meta JSONB;
    v_size BIGINT;
    v_mime TEXT;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,909090));
    SELECT * INTO v_row FROM public.journey_videos WHERE id=p_video_id AND user_id=v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Video not owned by user' USING ERRCODE='42501'; END IF;
    IF v_row.status='ready' THEN RETURN v_row.id; END IF;
    IF v_row.status<>'reserved' OR v_row.expires_at<=now() THEN RAISE EXCEPTION 'No active valid reservation'; END IF;
    IF to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'Storage unavailable'; END IF;
    SELECT metadata INTO v_meta FROM storage.objects WHERE bucket_id='comparison_videos' AND name=v_row.storage_path;
    IF v_meta IS NULL THEN RAISE EXCEPTION 'Storage object not found'; END IF;
    v_size := (v_meta->>'size')::bigint;
    v_mime := COALESCE(v_meta->>'mimetype',v_meta->>'contentType');
    IF v_size IS NULL OR v_size<1 OR v_size>20971520 OR v_size>v_row.file_size_bytes THEN
        RAISE EXCEPTION 'Storage object exceeds reserved size' USING ERRCODE='22023';
    END IF;
    IF v_mime IS NULL OR v_mime NOT IN ('video/mp4','video/webm') THEN RAISE EXCEPTION 'Unsupported stored video MIME type'; END IF;
    UPDATE public.journey_videos SET status='ready',file_size_bytes=v_size,file_type=v_mime,finalized_at=now(),updated_at=now() WHERE id=p_video_id;
    RETURN p_video_id;
END;
$$;
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

    IF NOT EXISTS(SELECT 1 FROM public.journey_videos WHERE id=p_video_id AND user_id=v_user_id AND status='pending_deletion') THEN
        RAISE EXCEPTION 'Video must be marked for deletion first';
    END IF;
    IF p_success AND EXISTS (SELECT 1 FROM storage.objects o JOIN public.journey_videos v ON v.storage_path=o.name WHERE v.id=p_video_id AND v.user_id=v_user_id AND o.bucket_id='comparison_videos') THEN
        RAISE EXCEPTION 'Storage object still exists';
    END IF;
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
CREATE OR REPLACE FUNCTION public.cleanup_expired_journey_video_reservations()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    UPDATE public.journey_videos SET status='pending_deletion',deletion_requested_at=now()
      WHERE user_id=auth.uid() AND expires_at<now() AND (status='reserved'
        OR (status='deleted' AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='comparison_videos' AND o.name=journey_videos.storage_path)));
    GET DIAGNOSTICS v_count=ROW_COUNT;
    RETURN v_count;
END;
$$;


-- One authoritative exercise matcher for both the picker and persisted evidence.
-- Only exact, registered names qualify. Generic activity logs lack exercise-level proof.
CREATE OR REPLACE FUNCTION public.get_compatible_journey_evidence(
  p_exercise_id text, p_variant_id text, p_assistance text, p_run_id uuid DEFAULT NULL
) RETURNS TABLE(source_id uuid, recorded_at timestamptz, title text, run_id uuid, source_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sr.id,a.id), coalesce(sr.completed_at,wr.completed_at), wr.session_title, wr.id,
    CASE WHEN sr.id IS NOT NULL THEN 'session_result' ELSE 'activity' END
  FROM public.workout_runs wr
  JOIN public.activities a ON a.user_id=wr.user_id AND a.idempotency_key=wr.idempotency_key AND NOT a.is_planned
  LEFT JOIN public.session_results sr ON wr.user_id=sr.user_id AND wr.idempotency_key=sr.idempotency_key
  WHERE wr.user_id=auth.uid() AND wr.status='completed' AND (p_run_id IS NULL OR wr.id=p_run_id)
  AND EXISTS (
    SELECT 1 FROM public.workout_sets ws
    JOIN (VALUES
      ('standard_pull_up','deadstop','standard_pull_up'), ('standard_pull_up','deadstop','dead-stop pull-up'),
      ('standard_pull_up','unclassified','pull-up'), ('standard_pull_up','unclassified','hít xà đơn'),
      ('dead_hang','active_grip','dead_hang'), ('dead_hang','unclassified','dead hang'),
      ('dead_hang','unclassified','treo xà đơn (dead hang)'),
      ('inverted_row','horizontal_bar','inverted_row'), ('inverted_row','horizontal_bar','inverted row'),
      ('negative_pull_up','slow_eccentric','negative_pull_up'), ('negative_pull_up','slow_eccentric','negative pull-up')
    ) AS registry(exercise_id, default_variant, name)
      ON lower(regexp_replace(trim(ws.exercise_name),'\s+',' ','g'))=registry.name
    WHERE ws.run_id=wr.id AND ws.user_id=auth.uid() AND ws.status='completed'
      AND (CASE WHEN p_exercise_id='dead_hang' THEN ws.actual_unit='seconds' AND ws.actual_duration_seconds>0 ELSE ws.actual_unit='reps' AND ws.actual_reps>0 END)
      AND registry.exercise_id=p_exercise_id
      AND coalesce(nullif(ws.exercise_variant,''),registry.default_variant)=p_variant_id
      AND coalesce(nullif(ws.actual_assistance,''),'bodyweight')=p_assistance
  ) ORDER BY coalesce(sr.completed_at,wr.completed_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_compatible_journey_evidence(text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_compatible_journey_evidence(text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_journey_attempt_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.skill_milestones; v public.journey_videos;
BEGIN
  SELECT * INTO m FROM public.skill_milestones WHERE id=NEW.milestone_id AND journey_id=NEW.journey_id;
  IF m.id IS NULL OR NEW.exercise_id IS DISTINCT FROM m.exercise_id
    OR NEW.variant_id IS DISTINCT FROM m.variant_id THEN
    RAISE EXCEPTION 'Attempt does not match milestone exercise/variant' USING ERRCODE='23514';
  END IF;
  IF NEW.is_achieved_self_reported AND NEW.assistance IS DISTINCT FROM m.assistance THEN
    RAISE EXCEPTION 'Achievement must use milestone assistance' USING ERRCODE='23514';
  END IF;
  IF NEW.source_ref IS NOT NULL THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid()
      OR NOT EXISTS(SELECT 1 FROM public.get_compatible_journey_evidence(NEW.exercise_id,NEW.variant_id,NEW.assistance)
        WHERE source_id::text=NEW.source_ref->>'sourceId' AND source_type=NEW.source_ref->>'sourceType') THEN
      RAISE EXCEPTION 'Source must be an owned completed workout record matching this exercise, variant and assistance' USING ERRCODE='23514';
    END IF;
    NEW.source_ref=jsonb_build_object('sourceType',NEW.source_ref->>'sourceType','sourceId',NEW.source_ref->>'sourceId',
      'recordedAt',(SELECT recorded_at FROM public.get_compatible_journey_evidence(NEW.exercise_id,NEW.variant_id,NEW.assistance)
        WHERE source_id::text=NEW.source_ref->>'sourceId' LIMIT 1));
  END IF;
  IF NEW.video_id IS NOT NULL THEN
    SELECT * INTO v FROM public.journey_videos WHERE id=NEW.video_id AND user_id=NEW.user_id AND status='ready';
    IF v.id IS NULL OR v.exercise_id IS DISTINCT FROM NEW.exercise_id
      OR v.variant_id IS DISTINCT FROM NEW.variant_id THEN
      RAISE EXCEPTION 'Video must be owned, ready and match this exercise/variant' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_journey_attempt_links ON public.journey_attempts;
CREATE TRIGGER validate_journey_attempt_links BEFORE INSERT OR UPDATE OF source_ref,video_id,exercise_id,variant_id,assistance,milestone_id,journey_id,is_achieved_self_reported
ON public.journey_attempts FOR EACH ROW EXECUTE FUNCTION public.validate_journey_attempt_links();

-- A later edit to the workout proof invalidates linked claims too.
CREATE OR REPLACE FUNCTION public.invalidate_attempts_from_workout_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE proof_key text; proof_user uuid;
BEGIN
 IF TG_TABLE_NAME='workout_sets' THEN
   SELECT idempotency_key,user_id INTO proof_key,proof_user FROM public.workout_runs WHERE id=OLD.run_id;
 ELSE proof_key=OLD.idempotency_key; proof_user=OLD.user_id;
 END IF;
 UPDATE public.journey_attempts SET status='needs_review',source_invalidated_at=now(),
   source_invalidation_reason='Chi tiết buổi tập nguồn đã thay đổi hoặc bị xóa',updated_at=now()
 WHERE user_id=proof_user AND (source_ref->>'sourceId' IN (
   SELECT id::text FROM public.activities WHERE user_id=proof_user AND idempotency_key=proof_key
   UNION ALL SELECT id::text FROM public.session_results WHERE user_id=proof_user AND idempotency_key=proof_key
 ));
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DROP TRIGGER IF EXISTS invalidate_attempts_from_workout_sets ON public.workout_sets;
CREATE TRIGGER invalidate_attempts_from_workout_sets BEFORE UPDATE OR DELETE ON public.workout_sets
FOR EACH ROW EXECUTE FUNCTION public.invalidate_attempts_from_workout_proof();
DROP TRIGGER IF EXISTS invalidate_attempts_from_workout_run ON public.workout_runs;
CREATE TRIGGER invalidate_attempts_from_workout_run BEFORE UPDATE OR DELETE ON public.workout_runs
FOR EACH ROW EXECUTE FUNCTION public.invalidate_attempts_from_workout_proof();

-- Preserve timed sets as seconds through finalization.
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
    v_skipped_count INTEGER;
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
    WHERE run_id = p_run_id AND (status = 'pending' OR (status='completed' AND CASE WHEN actual_unit='seconds' THEN coalesce(actual_duration_seconds,0)<=0 ELSE coalesce(actual_reps,0)<=0 END));

    IF v_incomplete_count > 0 THEN
        IF NOT p_allow_partial THEN
            RAISE EXCEPTION 'INCOMPLETE_SETS: % uncompleted sets remain. Partial completion not allowed.', v_incomplete_count;
        ELSE
            -- Đánh dấu các hiệp chưa tập là 'skipped'
            UPDATE public.workout_sets
            SET status = 'skipped', updated_at = now()
            WHERE run_id = p_run_id AND (status = 'pending' OR (status='completed' AND CASE WHEN actual_unit='seconds' THEN coalesce(actual_duration_seconds,0)<=0 ELSE coalesce(actual_reps,0)<=0 END));
        END IF;
    END IF;

    SELECT count(*)::int INTO v_skipped_count FROM public.workout_sets WHERE run_id=p_run_id AND status='skipped';
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
            string_agg(CASE WHEN actual_unit='seconds' THEN actual_duration_seconds::text || 's' ELSE actual_reps::text END, ', ' ORDER BY set_order) AS reps_summary
        FROM public.workout_sets
        WHERE run_id = p_run_id AND status = 'completed' AND (CASE WHEN actual_unit='seconds' THEN actual_duration_seconds>0 ELSE actual_reps>0 END)
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
                'is_partial', (v_incomplete_count > 0 OR v_skipped_count > 0)
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
        'is_partial', (v_incomplete_count > 0 OR v_skipped_count > 0),
        'completed_exercises_count', jsonb_array_length(v_completed_exercises),
        'session_result_id', v_result_id,
        'activity_id', v_activity_id
    );
END;
$$;

-- Direct authenticated Storage reads/signing must honor the same tombstone as server actions.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
   DROP POLICY IF EXISTS comparison_videos_owner_select ON storage.objects;
   CREATE POLICY comparison_videos_owner_select ON storage.objects FOR SELECT TO authenticated
   USING (bucket_id='comparison_videos' AND auth.uid()::text=(storage.foldername(name))[1]
     AND EXISTS(SELECT 1 FROM public.journey_videos v WHERE v.user_id=auth.uid() AND v.storage_path=name AND v.status='ready'));
 END IF;
END $$;
