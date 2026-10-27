-- ==============================================================================
-- CALISCOACHING - MIGRATION 20261027000007: HEALTH PROFILE V2 SECURITY & CONSTRAINTS FIXES
-- Giải quyết các phát hiện kiểm toán S1, S2, S4:
-- 1. [S1] Thiết lập RLS policies cho bucket storage private health_documents
-- 2. [S2] Ràng buộc ngăn liên kết tài liệu y tế với sự kiện của người khác
-- 3. [S4] Ràng buộc toàn vẹn số đo observations (đơn vị không rỗng, giá trị dương)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. [S1] STORAGE OBJECT POLICIES CHO BUCKET HEALTH_DOCUMENTS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "health_documents_owner_select" ON storage.objects;
    DROP POLICY IF EXISTS "health_documents_owner_insert" ON storage.objects;
    DROP POLICY IF EXISTS "health_documents_owner_update" ON storage.objects;
    DROP POLICY IF EXISTS "health_documents_owner_delete" ON storage.objects;

    CREATE POLICY "health_documents_owner_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'health_documents' AND name LIKE (auth.uid()::text || '/%'));

    CREATE POLICY "health_documents_owner_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'health_documents' AND name LIKE (auth.uid()::text || '/%'));

    CREATE POLICY "health_documents_owner_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'health_documents' AND name LIKE (auth.uid()::text || '/%'))
      WITH CHECK (bucket_id = 'health_documents' AND name LIKE (auth.uid()::text || '/%'));

    CREATE POLICY "health_documents_owner_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'health_documents' AND name LIKE (auth.uid()::text || '/%'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. [S2] RÀNG BUỘC NGĂN LIÊN KẾT TÀI LIỆU VỚI SỰ KIỆN KHÁC OWNER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_health_document_event_owner()
RETURNS trigger AS $$
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.health_events
      WHERE id = NEW.event_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot link health document to an event owned by another user or non-existent event'
        USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_health_document_event_owner ON public.health_documents;
CREATE TRIGGER trg_check_health_document_event_owner
  BEFORE INSERT OR UPDATE OF event_id, user_id ON public.health_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.check_health_document_event_owner();

-- ------------------------------------------------------------------------------
-- 3. [S4] RÀNG BUỘC TOÀN VẸN SỐ ĐO (OBSERVATIONS): HỮU HẠN & ĐÚNG ĐƠN VỊ
-- ------------------------------------------------------------------------------
ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_metric_unit_non_empty,
  ADD CONSTRAINT observations_metric_unit_non_empty CHECK (length(trim(metric_unit)) > 0);

ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_metric_value_positive,
  ADD CONSTRAINT observations_metric_value_positive CHECK (
    metric_type = 'other' OR (
      metric_value > 0 AND
      metric_value <> 'NaN'::numeric AND
      metric_value < 'Infinity'::numeric AND
      metric_value > '-Infinity'::numeric
    )
  );

ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_metric_unit_by_type,
  ADD CONSTRAINT observations_metric_unit_by_type CHECK (
    length(trim(metric_unit)) = 0 OR
    (metric_type = 'weight' AND metric_unit IN ('kg', 'lbs')) OR
    (metric_type = 'height' AND metric_unit IN ('cm', 'm')) OR
    (metric_type = 'waist_circumference' AND metric_unit IN ('cm', 'inch')) OR
    (metric_type = 'resting_heart_rate' AND metric_unit = 'bpm') OR
    (metric_type NOT IN ('weight', 'height', 'waist_circumference', 'resting_heart_rate'))
  );
