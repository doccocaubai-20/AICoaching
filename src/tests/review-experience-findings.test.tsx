// Review-only tests against the frozen 5a9291b snapshot. No cloud or real user data.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  uid: 'synthetic-a',
  readError: false,
  activities: [] as any[],
  setters: [] as Array<{ initial: unknown; set: ReturnType<typeof vi.fn> }>,
}));
vi.mock('react', async importOriginal => {
  const original = await importOriginal<typeof import('react')>();
  const hooks = { useState(initial: unknown) {
    const set = vi.fn();
    state.setters.push({ initial, set });
    return [typeof initial === 'function' ? initial() : initial, set];
  } };
  return { ...original, ...hooks, default: { ...original, ...hooks } };
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('@/lib/supabase/env', () => ({ getSupabaseEnvStatus: () => ({ isConfigured: true, missingKeys: [] }) }));
vi.mock('@/lib/server/auth-guard', () => ({ getAuthenticatedUser: async () => ({
  user: state.uid ? { id: state.uid, user_metadata: {} } : null, error: null,
}) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({
  from(table: string) {
    const result = async () => state.readError ? { data: null, error: { message: 'Synthetic DB failure' } } : {
      data: table === 'profiles' ? { display_name: state.uid, experience_level: 'beginner' } :
        table === 'activities' ? state.activities : table === 'goals' ? [] : null,
      error: null,
    };
    const query: any = {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      gte: () => query, lte: () => query, or: () => query,
      maybeSingle: result,
      then: (resolve: any, reject: any) => result().then(resolve, reject),
    };
    return query;
  },
}) }));

import PassportPage from '@/app/passport/page';
import DashboardPage from '@/app/dashboard/page';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';

function find(node: any, predicate: (item: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const hit = find(child, predicate);
    if (hit) return hit;
  }
  return null;
}
const base = { displayName: 'Synthetic Athlete', totalSessions: 0, totalMinutes: 0, completedGoalsCount: 0, streakDays: 0 };
const markup = (props: Partial<React.ComponentProps<typeof AthletePassportCard>> = {}) =>
  renderToStaticMarkup(<AthletePassportCard {...base} {...props} />);

describe('Experience review: claimed behavior on actual changed components/routes', () => {
  beforeEach(() => {
    state.uid = 'synthetic-a'; state.readError = false; state.activities = []; state.setters = [];
    vi.unstubAllGlobals();
  });

  it('must encode different QR payloads for different share links', () => {
    const a = markup({ shareableUrl: 'https://example.invalid/share/synthetic-a' });
    const b = markup({ shareableUrl: 'https://example.invalid/share/synthetic-b' });
    const qr = (html: string) => html.match(/<svg viewBox="0 0 24 24"[\s\S]*?<\/svg>/)?.[0];
    expect(qr(a)).toBeDefined();
    expect(qr(a)).not.toBe(qr(b));
  });

  it('must preserve the shared card owner when another logged-in user follows its link', async () => {
    vi.stubGlobal('window', { location: { href: 'https://example.invalid/passport' } });
    const writeText = vi.fn((_value: string) => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const ownerTree = await PassportPage();
    const owner = find(ownerTree, node => node.type === AthletePassportCard).props;
    const ownerCard = AthletePassportCard(owner);
    find(ownerCard, node => node.type === 'button').props.onClick();
    state.uid = 'synthetic-b';
    // The generated link is the generic /passport route. It has no owner/token payload.
    const viewerTree = await PassportPage();
    const viewer = find(viewerTree, node => node.type === AthletePassportCard).props;
    expect({ copiedUrl: writeText.mock.calls[0][0], displayedOwner: viewer.displayName }).toEqual({
      copiedUrl: expect.any(String), displayedOwner: owner.displayName,
    });
  });

  it('must show zero streak for a user who has never exercised', async () => {
    const tree = await PassportPage();
    expect(find(tree, node => node.type === AthletePassportCard).props.streakDays).toBe(0);
  });

  it('must not turn 20 same-day activities into a 14-day streak', async () => {
    state.activities = Array.from({ length: 20 }, (_, i) => ({
      id: `synthetic-${i}`, start_at: '2026-10-27T08:00:00Z', duration_minutes: 5,
    }));
    const tree = await PassportPage();
    expect(find(tree, node => node.type === AthletePassportCard).props.streakDays).toBeLessThanOrEqual(1);
  });

  it('must not certify physical capability when there are no measurements', () => {
    expect(markup()).not.toMatch(/Đạt chuẩn|40%|35%|30%|45%/);
  });

  it('must render the promised fifth dimension when labeled 5-dimensional', () => {
    const html = markup();
    expect(html).toContain('5 Chiều');
    const bars = [...html.matchAll(/style="width:[0-9.]+%"/g)];
    expect(bars).toHaveLength(5);
  });

  it('must not assign the same claimed passport identifier to AB and BA', () => {
    const id = (name: string) => markup({ displayName: name }).match(/PASSPORT #CC-(\d+)/)?.[1];
    expect(id('AB')).not.toBe(id('BA'));
  });

  it('must show a read failure instead of silently issuing an empty passport', async () => {
    state.readError = true;
    const tree = await PassportPage();
    const card = find(tree, node => node.type === AthletePassportCard);
    expect(card).toBeNull();
  });

  it('must expose the promised Passport entry point on the Dashboard', async () => {
    const tree = await DashboardPage();
    expect(find(tree, node => node.props?.href === '/passport')).not.toBeNull();
  });

  it('must wait for successful Clipboard writing before claiming the link was copied', async () => {
    const rejected = Promise.reject(new Error('Synthetic clipboard permission denied'));
    rejected.catch(() => {}); // Observe the rejection in the test, avoiding an unrelated unhandled-rejection failure.
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => rejected) } });
    const tree = AthletePassportCard({ ...base, shareableUrl: 'https://example.invalid/share/synthetic-a' });
    find(tree, node => node.type === 'button').props.onClick();
    await Promise.resolve();
    expect(state.setters[0].set).not.toHaveBeenCalledWith(true);
  });
});
