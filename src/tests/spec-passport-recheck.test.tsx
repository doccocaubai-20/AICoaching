// Review-only: RLS-aware synthetic transport, real PassportPage; no network.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ uid: 'synthetic-b' }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('@/lib/supabase/env', () => ({ getSupabaseEnvStatus: () => ({ isConfigured: true, missingKeys: [] }) }));
vi.mock('@/lib/server/auth-guard', () => ({ getAuthenticatedUser: async () => ({
  user: { id: state.uid, user_metadata: { display_name: 'Synthetic B' } }, error: null,
}) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({
  from(table: string) {
    let targetUid: unknown;
    const result = async () => ({ data: targetUid !== state.uid ? (table === 'profiles' ? null : []) :
      table === 'profiles' ? { display_name: 'Synthetic B', experience_level: 'beginner' } : [], error: null });
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { if (key === 'user_id') targetUid = value; return query; },
      is: () => query,
      maybeSingle: result,
      then: (resolve: any, reject: any) => result().then(resolve, reject),
    };
    return query;
  },
}) }));
import PassportPage from '@/app/passport/page';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';
function find(node: any, predicate: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const hit = find(child, predicate); if (hit) return hit; }
  return null;
}
describe('Passport isolated request and RLS semantics', () => {
  it('ignores legacy user-id sharing and only renders the signed-in user', async () => {
    const tree = await PassportPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ u: 'synthetic-a' }) });
    const card = find(tree, node => node.type === AthletePassportCard);
    expect(card.props.userId).toBe('synthetic-b');
    expect(card.props.displayName).toBe('Synthetic B');
  });
});
