-- ==============================================================================
-- CALISCOACHING MVP - MIGRATION 20261027000004
-- 1. Theo đề xuất của Agent C: một hoạt động không quá 1440 phút (24 giờ).
--    Khớp với MAX_ACTIVITY_DURATION_MINUTES trong src/contracts/activity.contract.ts.
-- 2. Chuẩn bị cho Agent D: chặn tạo trùng gợi ý xem lại lịch còn hiệu lực
--    cho cùng bộ hoạt động và cùng phiên bản quy tắc.
-- ==============================================================================

ALTER TABLE public.activities
    ADD CONSTRAINT chk_activities_duration_max CHECK (duration_minutes <= 1440);

-- reference_activity_ids phải được sắp xếp tăng dần trước khi ghi (so sánh mảng phụ thuộc thứ tự).
-- Gợi ý đã 'outdated' hoặc 'dismissed' không chặn việc tạo gợi ý mới cho cùng bộ hoạt động.
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_suggestions_active
    ON public.review_suggestions (user_id, rule_version, reference_activity_ids)
    WHERE status IN ('pending', 'acknowledged');
