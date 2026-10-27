-- Atomic health-document quota reservations and revocable Athlete Passport shares.

ALTER TABLE public.health_documents
  ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'ready';

ALTER TABLE public.health_documents
  DROP CONSTRAINT IF EXISTS health_documents_upload_status_check,
  ADD CONSTRAINT health_documents_upload_status_check
    CHECK (upload_status IN ('pending', 'ready'));

-- All document writes must pass through authenticated server actions and the RPCs below.
DROP POLICY IF EXISTS "health_documents_insert_own" ON public.health_documents;
DROP POLICY IF EXISTS "health_documents_update_own" ON public.health_documents;
DROP POLICY IF EXISTS "health_documents_delete_own" ON public.health_documents;

-- Upload and delete operations are server-only; owner-select remains available for signed downloads.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "health_documents_owner_insert" ON storage.objects;
    DROP POLICY IF EXISTS "health_documents_owner_update" ON storage.objects;
    DROP POLICY IF EXISTS "health_documents_owner_delete" ON storage.objects;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_health_document_upload(
  p_event_id UUID,
  p_title TEXT,
  p_file_name TEXT,
  p_file_type TEXT,
  p_file_size_bytes INTEGER,
  p_storage_path TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_used_bytes BIGINT;
  v_document_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_file_size_bytes < 1 OR p_file_size_bytes > 4194304 THEN
    RAISE EXCEPTION 'File size is outside the allowed range' USING ERRCODE = '22023';
  END IF;
  IF p_file_type NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
    RAISE EXCEPTION 'Unsupported file type' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_title)) = 0 OR length(p_title) > 200 OR length(trim(p_file_name)) = 0 THEN
    RAISE EXCEPTION 'Invalid document name' USING ERRCODE = '22023';
  END IF;
  IF p_storage_path NOT LIKE (v_user_id::TEXT || '/%') THEN
    RAISE EXCEPTION 'Storage path must be under the authenticated user prefix' USING ERRCODE = '42501';
  END IF;

  -- A transaction-level lock serializes reservations across serverless instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 808080));
  SELECT COALESCE(SUM(file_size_bytes), 0)
    INTO v_used_bytes
    FROM public.health_documents
   WHERE user_id = v_user_id;

  IF v_used_bytes + p_file_size_bytes > 104857600 THEN
    RAISE EXCEPTION 'User storage quota exceeded' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.health_documents (
    user_id, event_id, title, file_name, file_type, file_size_bytes,
    storage_path, notes, upload_status
  ) VALUES (
    v_user_id, p_event_id, trim(p_title), p_file_name, p_file_type,
    p_file_size_bytes, p_storage_path, NULLIF(trim(p_notes), ''), 'pending'
  ) RETURNING id INTO v_document_id;

  RETURN v_document_id;
END;
$$;

-- Match the request-body transport ceiling with a 4 MiB file limit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    UPDATE storage.buckets SET file_size_limit = 4194304 WHERE id = 'health_documents';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_health_document_upload(p_document_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_storage_path TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT storage_path INTO v_storage_path
    FROM public.health_documents
   WHERE id = p_document_id
     AND user_id = auth.uid()
     AND upload_status = 'pending';

  IF v_storage_path IS NULL THEN
    RAISE EXCEPTION 'Pending document not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
     WHERE bucket_id = 'health_documents'
       AND name = v_storage_path
  ) THEN
    RAISE EXCEPTION 'Uploaded object is missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.health_documents
     SET upload_status = 'ready', updated_at = now()
   WHERE id = p_document_id
     AND user_id = auth.uid()
     AND upload_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending document not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_health_document_upload(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.health_documents
   WHERE id = p_document_id
     AND user_id = auth.uid()
     AND upload_status = 'pending';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_health_document_upload(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_health_document_upload(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_health_document_upload(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_health_document_upload(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_health_document_upload(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_health_document_upload(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.athlete_passport_shares (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 40),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_passport_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "athlete_passport_shares_select_own" ON public.athlete_passport_shares;
DROP POLICY IF EXISTS "athlete_passport_shares_insert_own" ON public.athlete_passport_shares;
DROP POLICY IF EXISTS "athlete_passport_shares_update_own" ON public.athlete_passport_shares;
DROP POLICY IF EXISTS "athlete_passport_shares_delete_own" ON public.athlete_passport_shares;

CREATE POLICY "athlete_passport_shares_select_own" ON public.athlete_passport_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "athlete_passport_shares_insert_own" ON public.athlete_passport_shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "athlete_passport_shares_update_own" ON public.athlete_passport_shares
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "athlete_passport_shares_delete_own" ON public.athlete_passport_shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_athlete_passport_shares_updated_at
  BEFORE UPDATE ON public.athlete_passport_shares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
