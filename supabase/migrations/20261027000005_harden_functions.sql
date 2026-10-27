-- ==============================================================================
-- CALISCOACHING MVP - MIGRATION 20261027000005
-- Theo Supabase advisors sau khi đẩy lên Cloud:
-- 1. Hàm trigger SECURITY DEFINER không được gọi trực tiếp qua /rest/v1/rpc.
-- 2. Cố định search_path cho hàm cập nhật updated_at.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
