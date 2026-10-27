// Review-only: RLS-aware synthetic transport, real PassportPage; no network.
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      maybeSingle: result,
      then: (resolve: any, reject: any) => result().then(resolve, reject),
    };
    return query;
  },
}) }));
import PassportPage from '@/app/passport/page';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';
import { setActiveSharedCard } from '@/lib/passport/passport-utils';
function find(node: any, predicate: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const hit = find(child, predicate); if (hit) return hit; }
  return null;
}
describe('Passport isolated request and RLS semantics', () => {
  beforeEach(() => setActiveSharedCard(null));
  it('does not issue a mismatched card when RLS hides the shared owner', async () => {
    const tree = await PassportPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ u: 'synthetic-a' }) });
    const card = find(tree, node => node.type === AthletePassportCard);
    // A proper denied/not-found state is acceptable; mixing owner A ID with B name is not.
    expect(card).toBeNull();
  });
});
