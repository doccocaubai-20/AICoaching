/**
 * CALISCOACHING - TEST SUITE CHO NHÓM TIÊU CHUẨN AN NINH & TOÀN VẸN DỮ LIỆU (S1–S5)
 * Kiểm chứng với PGlite và toàn bộ migrations thật của dự án:
 * - S1: RLS policies cho storage.objects theo owner
 * - S2: Ràng buộc ngăn liên kết tài liệu với sự kiện của người khác
 * - S4: Ràng buộc DB từ chối số đo âm và đơn vị rỗng
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const USER_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const SUPABASE_STUB = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE sql STABLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Minimal Storage Schema
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now()
);
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
`;

let db: PGlite;

type Actor = { role: 'authenticated'; uid: string } | { role: 'anon' } | { role: 'service_role' };

async function as<T>(actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const uid = actor.role === 'authenticated' ? actor.uid : '';
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await tx.exec(`SET LOCAL ROLE ${actor.role}`);
    return fn(tx);
  });
}

const actorUserA: Actor = { role: 'authenticated', uid: USER_A };
const actorUserB: Actor = { role: 'authenticated', uid: USER_B };
const actorAnon: Actor = { role: 'anon' };

describe('Kiểm thử An Ninh & Toàn Vẹn DB V2 (S1, S2, S4)', () => {
  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await db.exec(sql);
    }

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES
        ('${USER_A}', 'usera.security@example.com'),
        ('${USER_B}', 'userb.security@example.com')
      ON CONFLICT DO NOTHING;
    `);
  });

  // ============================================================================
  // S1: Storage Objects Policies
  // ============================================================================
  describe('S1: Storage RLS Policies cho bucket health_documents', () => {
    it('S1.1: Phải có 4 RLS policies trên storage.objects cho bucket health_documents', async () => {
      const res = await db.query(
        "SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'"
      );
      const policyNames = res.rows.map((r: any) => r.policyname);
      expect(policyNames).toContain('health_documents_owner_select');
      expect(policyNames).toContain('health_documents_owner_insert');
      expect(policyNames).toContain('health_documents_owner_update');
      expect(policyNames).toContain('health_documents_owner_delete');
    });

    it('S1.2: Authenticated User A có quyền insert file vào thư mục của mình (USER_A/...)', async () => {
      const res = await as(actorUserA, async (tx) => {
        return tx.query(
          "INSERT INTO storage.objects (bucket_id, name) VALUES ('health_documents', $1) RETURNING id",
          [`${USER_A}/test-doc.pdf`]
        );
      });
      expect(res.rows.length).toBe(1);
    });

    it('S1.3: Authenticated User A KHÔNG THỂ insert file vào thư mục của User B (USER_B/...)', async () => {
      await expect(
        as(actorUserA, async (tx) => {
          return tx.query(
            "INSERT INTO storage.objects (bucket_id, name) VALUES ('health_documents', $1) RETURNING id",
            [`${USER_B}/hacked-doc.pdf`]
          );
        })
      ).rejects.toThrow(/row-level security/);
    });

    it('S1.4: Anonymous KHÔNG THỂ đọc hoặc chèn file trong storage.objects', async () => {
      await expect(
        as(actorAnon, async (tx) => {
          return tx.query(
            "INSERT INTO storage.objects (bucket_id, name) VALUES ('health_documents', $1) RETURNING id",
            [`${USER_A}/anon-doc.pdf`]
          );
        })
      ).rejects.toThrow();

      const selectRes = await as(actorAnon, async (tx) => {
        return tx.query("SELECT * FROM storage.objects WHERE bucket_id = 'health_documents'");
      });
      expect(selectRes.rows.length).toBe(0);
    });
  });

  // ============================================================================
  // S2: Cross-Owner Document Linking Prevention
  // ============================================================================
  describe('S2: Ngăn liên kết tài liệu với sự kiện của người khác', () => {
    let eventBId: string;
    let eventAId: string;

    beforeAll(async () => {
      // User B tạo một sự kiện y tế
      const resB = await as(actorUserB, async (tx) => {
        return tx.query(
          "INSERT INTO health_events (user_id, event_type, event_date) VALUES ($1, 'checkup', '2026-10-27') RETURNING id",
          [USER_B]
        );
      });
      eventBId = (resB.rows[0] as { id: string }).id;

      // User A tạo một sự kiện y tế
      const resA = await as(actorUserA, async (tx) => {
        return tx.query(
          "INSERT INTO health_events (user_id, event_type, event_date) VALUES ($1, 'lab_test', '2026-10-27') RETURNING id",
          [USER_A]
        );
      });
      eventAId = (resA.rows[0] as { id: string }).id;
    });

    it('S2.1: User A bị chặn khi cố chèn tài liệu liên kết với event của User B', async () => {
      await expect(
        as(actorUserA, async (tx) => {
          return tx.query(
            `INSERT INTO health_documents (user_id, event_id, title, file_name, file_type, file_size_bytes, storage_path)
             VALUES ($1, $2, 'File Test', 'test.pdf', 'application/pdf', 1024, $3)`,
            [USER_A, eventBId, `${USER_A}/test.pdf`]
          );
        })
      ).rejects.toThrow(/Cannot link health document to an event owned by another user/);
    });

    it('S2.2: User A chèn tài liệu liên kết với event của chính mình thì thành công', async () => {
      const res = await as(actorUserA, async (tx) => {
        return tx.query(
          `INSERT INTO health_documents (user_id, event_id, title, file_name, file_type, file_size_bytes, storage_path)
           VALUES ($1, $2, 'File Hợp Lệ', 'my_doc.pdf', 'application/pdf', 2048, $3) RETURNING id`,
          [USER_A, eventAId, `${USER_A}/my_doc.pdf`]
        );
      });
      expect(res.rows.length).toBe(1);
    });

    it('S2.3: Khi sự kiện bị xóa, event_id chuyển thành NULL theo ON DELETE SET NULL mà không bị trigger chặn', async () => {
      await as(actorUserA, async (tx) => {
        await tx.query('DELETE FROM health_events WHERE id = $1', [eventAId]);
      });

      const docRes = await as(actorUserA, async (tx) => {
        return tx.query("SELECT event_id FROM health_documents WHERE title = 'File Hợp Lệ'");
      });
      expect((docRes.rows[0] as { event_id: string | null }).event_id).toBeNull();
    });
  });

  // ============================================================================
  // S4: Observations Database Constraints
  // ============================================================================
  describe('S4: Ràng buộc DB cho observations', () => {
    it('S4.1: DB từ chối cân nặng âm (-10 kg)', async () => {
      await expect(
        as(actorUserA, async (tx) => {
          return tx.query(
            "INSERT INTO observations (user_id, metric_type, metric_value, metric_unit) VALUES ($1, 'weight', -10, 'kg')",
            [USER_A]
          );
        })
      ).rejects.toThrow(/observations_metric_value_positive/);
    });

    it('S4.2: DB từ chối đơn vị rỗng hoặc chỉ có khoảng trắng', async () => {
      await expect(
        as(actorUserA, async (tx) => {
          return tx.query(
            "INSERT INTO observations (user_id, metric_type, metric_value, metric_unit) VALUES ($1, 'weight', 70, '   ')",
            [USER_A]
          );
        })
      ).rejects.toThrow(/observations_metric_unit_non_empty/);
    });

    it('S4.3: DB chấp nhận chỉ số hợp lệ (cân nặng 70 kg, chiều cao 175 cm)', async () => {
      const res = await as(actorUserA, async (tx) => {
        return tx.query(
          "INSERT INTO observations (user_id, metric_type, metric_value, metric_unit) VALUES ($1, 'weight', 70, 'kg') RETURNING id",
          [USER_A]
        );
      });
      expect(res.rows.length).toBe(1);
    });
  });
});
