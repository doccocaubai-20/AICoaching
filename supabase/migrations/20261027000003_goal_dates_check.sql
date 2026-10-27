-- ==============================================================================
-- CALISCOACHING MVP - MIGRATION 20261027000003
-- Theo đề xuất của Agent B: ngày kết thúc mục tiêu không sớm hơn ngày bắt đầu.
-- Khớp với validateGoalDates() trong src/contracts/goal.contract.ts.
-- ==============================================================================

ALTER TABLE public.goals
    ADD CONSTRAINT chk_goals_dates
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);
