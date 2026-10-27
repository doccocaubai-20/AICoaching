// Review-only probes; real UI/action paths, synthetic inputs, no network.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const testState = vi.hoisted(() => ({
  index: 0, values: new Map<number, any>(),
  add: vi.fn(), update: vi.fn(), background: vi.fn(),
}));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const hooks = {
    useState(initial: any) {
      const id = testState.index++;
      if (!testState.values.has(id)) testState.values.set(id, typeof initial === 'function' ? initial() : initial);
      return [testState.values.get(id), (value: any) => testState.values.set(id,
        typeof value === 'function' ? value(testState.values.get(id)) : value)];
    }, useEffect: vi.fn(),
  };
  return { ...actual, ...hooks, default: { ...actual, ...hooks } };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({ requireAuthenticatedUser: async () => ({ user: { id: 'synthetic-a' } }) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ from() {
  const builder: any = { select: () => builder, eq: () => builder, insert: () => builder,
    update: () => builder, maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve({ error: null }).then(resolve, reject) };
  return builder;
} }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => null }));
vi.mock('@/lib/ai/factory', () => ({ getAIAdapter: () => null }));
vi.mock('@/lib/server/health-profile-actions', () => ({
  addObservationDirectAction: testState.add,
  updateObservationAction: testState.update,
  updateHealthProfileBackgroundAction: testState.background,
  addBloodPressureAction: vi.fn(), deleteBloodPressureAction: vi.fn(), updateBloodPressureAction: vi.fn(),
}));
import { grantConsentAction } from '@/app/ai/actions';
import { VitalsTab } from '@/components/health-v2/VitalsTab';
import { HealthProfileContainer } from '@/components/health-v2/HealthProfileContainer';
import { HealthOverviewTab } from '@/components/health-v2/HealthOverviewTab';
import { LiveWorkoutModal } from '@/components/programs/LiveWorkoutModal';

function find(node: any, predicate: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const hit = find(child, predicate); if (hit) return hit;
  }
  return null;
}
function render(fn: () => any) { testState.index = 0; return fn(); }
describe('7debc35 actual integration review', () => {
  beforeEach(() => {
    testState.values.clear(); testState.index = 0;
    testState.add.mockReset().mockResolvedValue({ success: true });
    testState.update.mockReset().mockResolvedValue({ success: true });
    testState.background.mockReset().mockResolvedValue({ success: true });
    vi.stubEnv('TZ', 'Asia/Bangkok');
    vi.useFakeTimers().setSystemTime(new Date('2026-10-27T08:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('must allow explicit consent to the advertised new daily-checkin AI scope', async () => {
    expect(await grantConsentAction(['daily_checkins'])).toMatchObject({ success: true });
  });

  it('must record a newly entered measurement at the actual current instant', async () => {
    testState.values.set(2, '70');
    const tree = render(() => VitalsTab({ observations: [], bloodPressures: [] }));
    await find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(testState.add.mock.calls[0][0].observed_at).toBe('2026-10-27T08:00:00.000Z');
  });

  it('must preserve a measurement timestamp when editing without changing its date', async () => {
    testState.values.set(0, 'history');
    const observation: any = { id: 'synthetic-obs', metric_type: 'weight', metric_value: 70, metric_unit: 'kg',
      observed_at: '2026-10-27T08:00:00.000Z', source: 'self_reported', notes: null };
    const props = { observations: [observation], bloodPressures: [] };
    let tree = render(() => VitalsTab(props));
    find(tree, n => n.type === 'button' && n.props.title === 'Sửa bản ghi chỉ số').props.onClick();
    tree = render(() => VitalsTab(props));
    await find(tree, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(testState.update.mock.calls[0][1].observed_at).toBe(observation.observed_at);
  });

  it('must not save prescribed target reps as actual completed reps without user input', async () => {
    testState.values.set(0, 'finished'); testState.values.set(4, 600);
    const save = vi.fn(async (_data: any) => ({ success: true }));
    const tree = render(() => LiveWorkoutModal({ session: { id: 'synthetic-session', title: 'Synthetic', exercises: [
      { name: 'Synthetic exercise', sets: 2, target_reps: '8–12', rest_seconds: 30 },
    ] } as any, onFinishWorkout: save, onClose() {} }));
    await find(tree, n => n.type === 'button' && n.props.disabled !== undefined).props.onClick();
    expect(save.mock.calls[0][0].completedExercises[0].actual_reps).not.toBe('8–12');
  });

  it('must block background-profile overwrite after its initial read failed', async () => {
    const container = render(() => HealthProfileContainer({
      userDisplayName: 'Synthetic', userExperienceLevel: 'beginner', userEquipment: [], userSchedule: [],
      profileError: null, goals: [], goalsError: null, healthProfile: null, healthProfileError: 'Synthetic DB error',
      observations: [], bloodPressures: [], dailyCheckins: [], conditions: [], allergies: [], medications: [],
      healthEvents: [], documents: [], activities: [], isConfigured: true,
    }));
    const child = find(container, n => n.type === HealthOverviewTab);
    if (!child) return; // A correctly blocked section cannot submit an empty profile.
    testState.values.clear();
    let tree = render(() => HealthOverviewTab(child.props));
    const edit = find(tree, n => n.type === 'button' && n.props.children === 'Chỉnh sửa');
    if (!edit || edit.props.disabled) return;
    edit.props.onClick();
    tree = render(() => HealthOverviewTab(child.props));
    const form = find(tree, n => n.type === 'form');
    if (form) await form.props.onSubmit({ preventDefault() {} });
    expect(testState.background).not.toHaveBeenCalled();
  });
});
