import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const testState = vi.hoisted(() => ({
  querySessionResults: null as null | ((filters: { column: string; operator: string; value: unknown }[]) => Promise<unknown>),
  lastDatabaseError: null as string | null,
  forceReadFailure: false,
  adapter: vi.fn(() => null),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({
  requireAuthenticatedUser: async () => ({ user: { id: '00000000-0000-4000-8000-000000000099' } }),
}));
vi.mock('@/lib/ai/factory', () => ({ getAIAdapter: testState.adapter }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({ from: () => ({ insert: (row: object) => ({
    select: () => ({ single: async () => ({ data: { id: 'synthetic-summary', ...row }, error: null }) }),
  }) }) }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    from(table: string) {
      const filters: { column: string; operator: string; value: unknown }[] = [];
      const result = async () => {
        if (table === 'ai_consents') return { data: {
          is_granted: true, revoked_at: null, consent_version: 'v1.0-mvp',
          scope: ['profile', 'goals', 'activities', 'observations'],
        }, error: null };
        if (table === 'session_results') return testState.querySessionResults!(filters);
        return { data: table === 'profiles' ? null : [], error: null };
      };
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { filters.push({ column, operator: '=', value }); return builder; },
        is() { return builder; },
        gte(column: string, value: unknown) { filters.push({ column, operator: '>=', value }); return builder; },
        lte(column: string, value: unknown) { filters.push({ column, operator: '<=', value }); return builder; },
        order() { return builder; },
        maybeSingle: result,
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return result().then(resolve, reject); },
      };
      return builder;
    },
  }),
}));

import { analyzeProfileTrendsAction } from '@/app/ai/actions';

describe('Trend action reads against the real migrated session_results schema', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}'::jsonb);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    `);
    const migrations = path.resolve(__dirname, '../../supabase/migrations');
    for (const file of fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
      await db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'));
    }
    testState.querySessionResults = async filters => {
      if (testState.forceReadFailure) return { data: null, error: { code: '08006' } };
      try {
        const conditions = filters.map((filter, index) => `"${filter.column}" ${filter.operator} $${index + 1}`);
        const result = await db.query(`SELECT * FROM public.session_results WHERE ${conditions.join(' AND ')}`,
          filters.map(filter => filter.value));
        return { data: result.rows, error: null };
      } catch (error) {
        testState.lastDatabaseError = (error as { code?: string }).code || 'UNKNOWN';
        return { data: null, error: { code: testState.lastDatabaseError } };
      }
    };
  }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(() => {
    testState.lastDatabaseError = null;
    testState.forceReadFailure = false;
    testState.adapter.mockClear();
  });

  it.each([4, 8] as const)('loads the %s-week window using columns that actually exist', async weeks => {
    const result = await analyzeProfileTrendsAction(weeks);
    expect(testState.lastDatabaseError).toBeNull();
    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.summary?.status).toBe('template_fallback');
  });

  it('still stops before AI when the database genuinely fails', async () => {
    testState.forceReadFailure = true;
    const result = await analyzeProfileTrendsAction(4);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Không tải được dữ liệu hồ sơ, thử lại sau');
    expect(testState.adapter).not.toHaveBeenCalled();
  });
});
