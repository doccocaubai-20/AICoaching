// Regression probes for the server-owned document upload flow. All storage calls are mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  docs: [] as any[],
  files: new Map<string, number>(),
  usedBytes: 0,
  nextId: 0,
  failUpload: false,
  failFinalize: false,
  failRemove: false,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({
  requireAuthenticatedUser: async () => ({ user: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' } }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string, content: ArrayBuffer) => {
          if (state.failUpload) return { error: { message: 'Synthetic upload failure' } };
          state.files.set(path, content.byteLength);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          if (state.failRemove) return { error: { message: 'Synthetic remove failure' } };
          paths.forEach(path => state.files.delete(path));
          return { error: null };
        },
      }),
    },
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    from(table: string) {
      const filters = new Map<string, unknown>();
      let selected = '';
      const builder: any = {
        select: (fields: string) => { selected = fields; return builder; },
        eq: (key: string, value: unknown) => { filters.set(key, value); return builder; },
        lt: (key: string, value: unknown) => { filters.set(`${key}_lt`, value); return builder; },
        single: async () => {
          const row = state.docs.find(doc => [...filters].every(([key, value]) => doc[key] === value));
          return { data: row || null, error: row ? null : { message: 'Not found' } };
        },
        then: (resolve: any, reject: any) => {
          const data = table === 'health_documents' && selected === 'id, storage_path'
            ? state.docs.filter(doc => [...filters].every(([key, value]) => {
              if (key === 'created_at_lt') return doc.created_at < String(value);
              return doc[key] === value;
            }))
            : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
    rpc: async (name: string, args: Record<string, any>) => {
      if (name === 'reserve_health_document_upload') {
        const used = state.docs.reduce((sum, doc) => sum + doc.file_size_bytes, 0);
        if (used + args.p_file_size_bytes > 100 * 1024 * 1024) {
          return { data: null, error: { message: 'User storage quota exceeded' } };
        }
        const id = `synthetic-${++state.nextId}`;
        state.docs.push({
          id,
          user_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
          event_id: args.p_event_id,
          title: args.p_title,
          file_name: args.p_file_name,
          file_type: args.p_file_type,
          file_size_bytes: args.p_file_size_bytes,
          storage_path: args.p_storage_path,
          notes: args.p_notes,
          upload_status: 'pending',
          created_at: new Date().toISOString(),
        });
        return { data: id, error: null };
      }
      if (name === 'finalize_health_document_upload') {
        if (state.failFinalize) return { data: null, error: { message: 'Synthetic finalize failure' } };
        const doc = state.docs.find(item => item.id === args.p_document_id);
        if (!doc || !state.files.has(doc.storage_path)) return { data: null, error: { message: 'Uploaded object is missing' } };
        doc.upload_status = 'ready';
        return { data: doc.id, error: null };
      }
      if (name === 'cancel_health_document_upload') {
        state.docs = state.docs.filter(doc => doc.id !== args.p_document_id || doc.upload_status !== 'pending');
        return { data: true, error: null };
      }
      return { data: null, error: { message: `Unexpected RPC ${name}` } };
    },
  }),
}));

import { uploadHealthDocumentAction, createHealthDocumentAction } from '@/lib/server/health-profile-actions';
import { MAX_DOCUMENT_SIZE_BYTES, USER_STORAGE_QUOTA_BYTES } from '@/contracts';

const MB = 1024 * 1024;
function pdf(size = 100) {
  const bytes = new Uint8Array(size);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const formData = new FormData();
  formData.append('file', new File([bytes], 'synthetic.pdf', { type: 'application/pdf' }));
  formData.append('title', 'Synthetic document');
  return formData;
}

describe('Health document upload review regressions', () => {
  beforeEach(() => {
    state.docs = [];
    state.files.clear();
    state.nextId = 0;
    state.failUpload = false;
    state.failFinalize = false;
    state.failRemove = false;
  });

  it('must reserve quota across concurrent uploads at the 4 MiB transport ceiling', async () => {
    state.docs = [{ file_size_bytes: 98 * MB, upload_status: 'ready' }];
    const results = await Promise.all([uploadHealthDocumentAction(pdf(2 * MB)), uploadHealthDocumentAction(pdf(2 * MB))]);
    const usage = state.docs.reduce((sum, doc) => sum + doc.file_size_bytes, 0);
    expect({ successful: results.filter(result => result.success).length, withinQuota: usage <= USER_STORAGE_QUOTA_BYTES })
      .toEqual({ successful: 1, withinQuota: true });
  });

  it('must reject files above the maximum supported by Vercel Server Actions', async () => {
    const result = await uploadHealthDocumentAction(pdf(MAX_DOCUMENT_SIZE_BYTES + 1));
    expect(result).toMatchObject({ success: false, message: expect.stringContaining('4 MiB') });
    expect(state.docs).toHaveLength(0);
  });

  it('must keep a failed finalization attached to its pending metadata if cleanup also fails', async () => {
    state.failFinalize = true;
    state.failRemove = true;
    const result = await uploadHealthDocumentAction(pdf());
    expect(result.success).toBe(false);
    expect(state.docs).toHaveLength(1);
    expect(state.docs[0].upload_status).toBe('pending');
    expect(state.files.has(state.docs[0].storage_path)).toBe(true);
  });

  it('must reject metadata for a storage object that was never uploaded', async () => {
    const result = await createHealthDocumentAction({
      title: 'Synthetic',
      file_name: 'synthetic.pdf',
      file_type: 'application/pdf',
      file_size_bytes: 100,
      storage_path: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/never-uploaded.pdf',
    });
    expect(result.success).toBe(false);
  });
});
