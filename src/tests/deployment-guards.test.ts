import { describe, expect, it } from 'vitest';
import type { ActivityEntity, ProfileEntity } from '@/contracts';
import { computeProfileMetrics, verifyAITrendHighlights } from '@/lib/ai/trend-analysis';

const now = new Date('2026-10-27T12:00:00Z');
const activity: ActivityEntity = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  activity_type: 'calisthenics',
  is_planned: false,
  start_at: '2026-10-26T10:00:00Z',
  duration_minutes: 30,
  fatigue_level: null,
  notes: null,
  source: 'manual_entry',
  idempotency_key: 'deployment-synthetic-activity',
  created_at: '2026-10-26T10:00:00Z',
  updated_at: '2026-10-26T10:00:00Z',
};

describe('Deployment guards for the captured CalisCoaching version', () => {
  it('ignores null and primitive schedule values before matching a valid day', () => {
    const profile: ProfileEntity = {
      user_id: activity.user_id,
      display_name: 'Synthetic fixture',
      experience_level: 'beginner',
      available_equipment: [],
      schedule_availability: [null, 'monday', { day_of_week: 'monday', available_time_slots: ['17:00 - 18:00'] }],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const metrics = computeProfileMetrics({ activities: [activity], profile, now, weeks: 4 });
    expect(metrics.schedule_alignment.matching_sessions_count).toBe(1);
  });

  it('rejects a wrong percent before punctuation and retains the calculated percent', () => {
    const metrics = computeProfileMetrics({ activities: [activity], now, weeks: 4 });
    const makeHighlight = (percent: number) => ({
      metric_key: 'sport_distribution:calisthenics',
      text: `Calisthenics chiếm ${percent}% tổng thời lượng.`,
      references: [{ type: 'activity' as const, id: activity.id }],
    });
    const ids = new Set(metrics.allowed_record_ids);
    expect(verifyAITrendHighlights([makeHighlight(999)], metrics, ids).rejectedCount).toBe(1);
    expect(verifyAITrendHighlights([makeHighlight(100)], metrics, ids).validHighlights).toHaveLength(1);
  });
});
