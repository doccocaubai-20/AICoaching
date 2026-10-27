// Review regression expectations on updated code.
// All identities/data are synthetic; Supabase and AI never access the network.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  hookIndex: 0,
  overrides: {} as Record<number, unknown>,
  record: vi.fn(),
  inserts: [] as unknown[],
  deletes: [] as string[],
  storageRemove: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const original = await importOriginal<typeof import('react')>();
  const hooks = {
    useState(initial: unknown) {
      const index = state.hookIndex++;
      return [Object.hasOwn(state.overrides, index) ? state.overrides[index] :
        (typeof initial === 'function' ? initial() : initial), vi.fn()];
    },
    useEffect: vi.fn(),
  };
  return { ...original, ...hooks, default: { ...original, ...hooks } };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({
  requireAuthenticatedUser: async () => ({ user: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' } }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    storage: { from: () => ({ remove: state.storageRemove }) },
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        insert: (row: unknown) => { state.inserts.push(row); return builder; },
        upsert: (row: unknown) => { state.inserts.push(row); return builder; },
        delete: () => { state.deletes.push(table); return builder; },
        maybeSingle: async () => ({ data: { storage_path: 'synthetic/file.pdf' }, error: null }),
        single: async () => ({ data: state.inserts.at(-1), error: null }),
        then: (resolve: any, reject: any) => Promise.resolve({ error: null }).then(resolve, reject),
      };
      return builder;
    },
  }),
}));
vi.mock('@/app/programs/actions', () => ({ recordSessionResultAction: state.record }));

import { AISynergyGuardCard } from '@/components/health/AISynergyGuardCard';
import { ProgramsManager } from '@/components/programs/ProgramsManager';
import { LiveWorkoutModal } from '@/components/programs/LiveWorkoutModal';
import { HealthOverviewTab } from '@/components/health-v2/HealthOverviewTab';
import { DailyCheckinTab } from '@/components/health-v2/DailyCheckinTab';
import { computeCheckinWeeklyStats } from '@/contracts';
import { cleanCompletedExercises } from '@/components/programs/program-utils';
import { addObservationDirectAction, deleteHealthDocumentAction } from '@/lib/server/health-profile-actions';

function find(node: any, predicate: (item: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

const session: any = { id: 'synthetic-session', title: 'Synthetic session', exercises: [
  { name: 'Synthetic exercise', sets: 2, target_reps: '5', rest_seconds: 30 },
] };
function getLiveProps() {
  state.hookIndex = 0;
  state.overrides = { 2: session };
  const tree = ProgramsManager({ program: null, sessions: [session], sessionResults: [], suggestions: [], isConfigured: true });
  return find(tree, node => node.type === LiveWorkoutModal).props;
}
function finishedModal(onFinishWorkout: any, onClose: any) {
  state.hookIndex = 0;
  state.overrides = { 0: 'finished', 4: 600 };
  const tree = LiveWorkoutModal({ session, onFinishWorkout, onClose });
  return find(tree, node => node.type === 'button' && node.props.disabled !== undefined);
}

describe('Review V2: expected user behavior on actual changed code', () => {
  beforeEach(() => {
    state.hookIndex = 0;
    state.overrides = {};
    state.record.mockReset().mockResolvedValue({ success: false, message: 'Synthetic DB error' });
    state.inserts = [];
    state.deletes = [];
    state.storageRemove.mockReset().mockResolvedValue({ data: null, error: { message: 'Synthetic storage error' } });
  });
  afterEach(() => vi.useRealTimers());

  it('must not show a Green Light when all health data is missing', () => {
    const html = renderToStaticMarkup(<AISynergyGuardCard todayCheckin={null} conditions={[]} latestBP={null} />);
    expect(html).not.toContain('Green Light');
  });

  it('must retain document metadata when Storage deletion fails', async () => {
    const result = await deleteHealthDocumentAction('synthetic-document');
    expect({ success: result.success, deletedMetadata: state.deletes.includes('health_documents') })
      .toEqual({ success: false, deletedMetadata: false });
  });

  it('must reject negative weight and empty units before inserting', async () => {
    const result = await addObservationDirectAction({ metric_type: 'weight', metric_value: -10, metric_unit: '' });
    expect({ success: result.success, inserts: state.inserts.length }).toEqual({ success: false, inserts: 0 });
  });

  it('must keep the Live modal open when the real callback receives success:false', async () => {
    const props = getLiveProps();
    const onClose = vi.fn();
    await finishedModal(props.onFinishWorkout, onClose).props.onClick();
    expect(state.record).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('must send exercise results in the server contract format', async () => {
    const props = getLiveProps();
    await finishedModal(props.onFinishWorkout, vi.fn()).props.onClick();
    const form = state.record.mock.calls[0][1] as FormData;
    expect(cleanCompletedExercises(JSON.parse(String(form.get('completed_exercises'))))).toHaveLength(1);
  });

  it('must reuse an idempotency key when retrying the same Live result', async () => {
    const props = getLiveProps();
    const data = { durationMinutes: 10, perceivedExertion: 5, notes: '', completedExercises: [] };
    await props.onFinishWorkout(data);
    await props.onFinishWorkout(data);
    expect(state.record.mock.calls[0][1].get('idempotency_key')).toBe(state.record.mock.calls[1][1].get('idempotency_key'));
  });

  it('must not label 30 check-ins across a month as 30/7 days', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-27T12:00:00Z'));
    const dailyCheckins = Array.from({ length: 30 }, (_, index) => ({
      id: `synthetic-${index}`, local_date: new Date(Date.UTC(2026, 9, 27 - index)).toISOString().slice(0, 10),
      sleep_duration_minutes: 480, energy_level: null, stress_level: null,
    })) as any;
    const html = renderToStaticMarkup(<HealthOverviewTab healthProfile={null} observations={[]} bloodPressures={[]}
      dailyCheckins={dailyCheckins} conditions={[]} allergies={[]} medications={[]} healthEvents={[]} documents={[]}
      activities={[]} goals={[]} onNavigateTab={() => {}} />);
    expect(html).not.toContain('30/7');
  });

  it('must include explicitly recorded zero sleep instead of discarding it', () => {
    const checkins = [{ sleep_duration_minutes: 0 }, { sleep_duration_minutes: 480 }] as any;
    expect(computeCheckinWeeklyStats(checkins).averageSleepMinutes).toBe(240);
  });

  it('must choose local Vietnam date at 01:00 instead of the previous UTC date', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-27T18:00:00Z'));
    const tree = DailyCheckinTab({ dailyCheckins: [], activities: [] });
    expect(find(tree, node => node.type === 'input' && node.props.type === 'date').props.value).toBe('2026-10-28');
  });

  it('must preserve null values when resaving an existing partial check-in', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-27T12:00:00Z'));
    const checkin: any = { id: 'synthetic', local_date: '2026-10-27', sleep_duration_minutes: null,
      sleep_quality: null, energy_level: null, stress_level: null, notes: 'Synthetic note' };
    const tree = DailyCheckinTab({ dailyCheckins: [checkin], activities: [] });
    // Run the real form handler AND real server action, mocking only DB transport.
    await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(state.inserts.at(-1)).toMatchObject({ sleep_duration_minutes: null,
      sleep_quality: null, energy_level: null, stress_level: null });
  });
});
