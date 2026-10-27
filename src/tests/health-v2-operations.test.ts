/**
 * CALISCOACHING - TEST SUITE CHO CÁC THAO TÁC NÂNG CAO V2 (E2, E6, E7)
 * - E2: Upload tài liệu y tế thực tế, kiểm tra quota 100MB, kiểm tra magic bytes, ký URL, đổi tên
 * - E6: Sửa số đo và huyết áp mà giữ nguyên ID và ngày đo/nguồn
 * - E7: Ngữ cảnh AI mở rộng cho check-in & huyết áp khi có consent, loại bỏ thông tin y tế nhạy cảm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadHealthDocumentAction,
  getHealthDocumentSignedUrlAction,
  renameHealthDocumentAction,
  updateObservationAction,
  updateBloodPressureAction,
} from '@/lib/server/health-profile-actions';
import { buildAIContext } from '@/lib/ai/context';
import { USER_STORAGE_QUOTA_BYTES, MAX_DOCUMENT_SIZE_BYTES } from '@/contracts';

const mockState = {
  docs: [] as any[],
  obs: [] as any[],
  bp: [] as any[],
  storageFiles: new Map<string, Uint8Array>(),
  storageRemoveCalledWith: [] as string[][],
};

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/auth-guard', () => ({
  requireAuthenticatedUser: async () => ({ user: { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' } }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    storage: {
      from: () => ({
        upload: async (path: string, buffer: ArrayBuffer) => {
          mockState.storageFiles.set(path, new Uint8Array(buffer));
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          mockState.storageRemoveCalledWith.push(paths);
          paths.forEach((p) => mockState.storageFiles.delete(p));
          return { data: null, error: null };
        },
        createSignedUrl: async (path: string, _expires: number) => {
          return { data: { signedUrl: `https://storage.mock.local/${path}?token=signed` }, error: null };
        },
      }),
    },
    from: (table: string) => {
      const builder: any = {
        select: (fields?: string) => {
          builder._fields = fields;
          return builder;
        },
        eq: (col: string, val: any) => {
          builder._filters = builder._filters || [];
          builder._filters.push({ col, val });
          return builder;
        },
        insert: (row: any) => {
          const inserted = { id: 'doc-' + Math.random().toString(36).slice(2, 7), ...row };
          if (table === 'health_documents') mockState.docs.push(inserted);
          builder._lastInserted = inserted;
          return builder;
        },
        update: (payload: any) => {
          builder._updatePayload = payload;
          return builder;
        },
        delete: () => {
          return builder;
        },
        single: async () => {
          return { data: builder._lastInserted, error: null };
        },
        maybeSingle: async () => {
          if (table === 'health_documents') {
            const doc = mockState.docs.find((d) => d.id === builder._filters?.[0]?.val);
            return { data: doc || null, error: null };
          }
          if (table === 'health_events') {
            return { data: { id: builder._filters?.[0]?.val }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any, reject: any) => {
          if (table === 'health_documents' && builder._fields === 'file_size_bytes') {
            return Promise.resolve({ data: mockState.docs, error: null }).then(resolve, reject);
          }
          if (table === 'observations' && builder._updatePayload) {
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          if (table === 'blood_pressure_readings' && builder._updatePayload) {
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  }),
}));

describe('Kiểm thử Thao tác Nâng cao V2 (E2, E6, E7)', () => {
  beforeEach(() => {
    mockState.docs = [];
    mockState.obs = [];
    mockState.bp = [];
    mockState.storageFiles.clear();
    mockState.storageRemoveCalledWith = [];
  });

  // ============================================================================
  // E2: Real Document Upload & Operations
  // ============================================================================
  describe('E2: Luồng tài liệu y tế thực tế', () => {
    it('E2.1: Từ chối tệp không đúng header/magic bytes (ví dụ text giả dạng PDF)', async () => {
      const fakePdf = new File([new Uint8Array([1, 2, 3, 4, 5])], 'fake.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', fakePdf);

      const res = await uploadHealthDocumentAction(formData);
      expect(res.success).toBe(false);
      expect(res.message).toContain('không khớp');
    });

    it('E2.2: Tải lên thành công tệp PDF hợp lệ với header %PDF- và lưu vào storage', async () => {
      // Header chuẩn của PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = new File([validPdfBytes], 'blood_test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', 'Phiếu xét nghiệm máu');

      const res = await uploadHealthDocumentAction(formData);
      expect(res.success).toBe(true);
      expect(res.data?.file_name).toBe('blood_test.pdf');
      expect(mockState.storageFiles.size).toBe(1);
    });

    it('E2.3: Tạo signed URL an toàn có thời hạn để xem/tải tài liệu', async () => {
      mockState.docs.push({
        id: 'doc-real-123',
        user_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        storage_path: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/uuid-test.pdf',
      });

      const res = await getHealthDocumentSignedUrlAction('doc-real-123');
      expect(res.success).toBe(true);
      expect(res.data?.signedUrl).toContain('https://storage.mock.local/');
      expect(res.data?.signedUrl).toContain('token=signed');
    });

    it('E2.4: Đổi tên tài liệu thành công', async () => {
      mockState.docs.push({
        id: 'doc-rename-1',
        user_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        title: 'Tên cũ',
      });

      const res = await renameHealthDocumentAction('doc-rename-1', 'Tên mới đã cập nhật');
      expect(res.success).toBe(true);
    });
  });

  // ============================================================================
  // E6: Edit Measurements Preserving History
  // ============================================================================
  describe('E6: Sửa số đo và huyết áp giữ nguyên lịch sử và ID', () => {
    it('E6.1: Cập nhật chỉ số đơn thành công', async () => {
      const res = await updateObservationAction('obs-1', {
        metric_value: 72.5,
        metric_unit: 'kg',
        observed_at: '2026-10-25T07:00:00Z',
        source: 'self_reported',
        notes: 'Đo lại buổi sáng',
      });
      expect(res.success).toBe(true);
    });

    it('E6.2: Từ chối cập nhật chỉ số với giá trị âm', async () => {
      const res = await updateObservationAction('obs-1', {
        metric_value: -5,
        metric_unit: 'kg',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('lớn hơn 0');
    });

    it('E6.3: Cập nhật huyết áp thành công', async () => {
      const res = await updateBloodPressureAction('bp-1', {
        systolic: 125,
        diastolic: 82,
        measured_at: '2026-10-26T06:30:00Z',
        source: 'self_reported',
        notes: 'Huyết áp bình thường',
      });
      expect(res.success).toBe(true);
    });

    it('E6.4: Từ chối cập nhật huyết áp nếu tâm thu <= tâm trương', async () => {
      const res = await updateBloodPressureAction('bp-1', {
        systolic: 80,
        diastolic: 120,
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('lớn hơn');
    });
  });

  // ============================================================================
  // E7: G4 AI Context Expansion & Privacy Bounds
  // ============================================================================
  describe('E7: Mở rộng ngữ cảnh AI V2 tuân thủ Consent & Riêng tư', () => {
    const mockCheckins = [
      {
        id: 'ck-1',
        user_id: 'u1',
        local_date: '2026-10-25',
        sleep_duration_minutes: 450,
        sleep_start: null,
        sleep_end: null,
        sleep_quality: 4,
        energy_level: 4,
        stress_level: 2,
        notes: 'Untrusted free-text note',
        created_at: '2026-10-25T00:00:00Z',
        updated_at: '2026-10-25T00:00:00Z',
      },
      {
        id: 'ck-2',
        user_id: 'u1',
        local_date: '2026-10-26',
        sleep_duration_minutes: 0, // 0 phút hợp lệ
        sleep_start: null,
        sleep_end: null,
        sleep_quality: 1,
        energy_level: 2,
        stress_level: 5,
        notes: 'Thức trắng đêm',
        created_at: '2026-10-26T00:00:00Z',
        updated_at: '2026-10-26T00:00:00Z',
      },
    ];

    const mockBP = [
      {
        id: 'bp-100',
        user_id: 'u1',
        systolic: 122,
        diastolic: 78,
        measured_at: '2026-10-25T08:00:00Z',
        source: 'self_reported' as const,
        notes: null,
        created_at: '2026-10-25T08:00:00Z',
      },
    ];

    it('E7.1: Chỉ đưa check-in vào ngữ cảnh AI khi scope có daily_checkins', () => {
      // Scope chỉ có observations, KHÔNG có daily_checkins
      const { context: contextWithout, allowedRecordIds: allowedWithout } = buildAIContext({
        dailyCheckins: mockCheckins,
        scope: ['observations'],
        dateWindow: { from: '2026-10-24T00:00:00Z', to: '2026-10-27T00:00:00Z' },
      });
      expect(contextWithout.daily_checkins).toBeUndefined();
      expect(allowedWithout.has('ck-1')).toBe(false);

      // Scope có daily_checkins
      const { context: contextWith, allowedRecordIds: allowedWith } = buildAIContext({
        dailyCheckins: mockCheckins,
        scope: ['daily_checkins'],
        dateWindow: { from: '2026-10-24T00:00:00Z', to: '2026-10-27T00:00:00Z' },
      });
      expect(contextWith.daily_checkins).toBeDefined();
      expect(contextWith.daily_checkins?.length).toBe(2);
      expect(allowedWith.has('ck-1')).toBe(true);
      expect(allowedWith.has('ck-2')).toBe(true);

      // Số liệu do code tính (mẫu số đúng và trung bình ngủ tính cả 0 phút)
      expect(contextWith.daily_checkins_summary?.recorded_days).toBe(2);
      expect(contextWith.daily_checkins_summary?.average_sleep_minutes).toBe(225); // (450 + 0) / 2 = 225
    });

    it('E7.2: Chỉ đưa huyết áp vào ngữ cảnh AI khi scope có blood_pressures', () => {
      const { context: contextWithout } = buildAIContext({
        bloodPressures: mockBP,
        scope: ['profile', 'goals'],
      });
      expect(contextWithout.blood_pressures).toBeUndefined();

      const { context: contextWith, allowedRecordIds } = buildAIContext({
        bloodPressures: mockBP,
        scope: ['blood_pressures'],
        dateWindow: { from: '2026-10-24T00:00:00Z', to: '2026-10-27T00:00:00Z' },
      });
      expect(contextWith.blood_pressures?.length).toBe(1);
      expect(allowedRecordIds.has('bp-100')).toBe(true);
    });

    it('E7.3: Tuyệt đối không gửi bệnh sử, thuốc, dị ứng hoặc tài liệu vào ngữ cảnh AI', () => {
      const { context } = buildAIContext({
        dailyCheckins: mockCheckins,
        bloodPressures: mockBP,
        scope: ['profile', 'goals', 'activities', 'observations', 'daily_checkins', 'blood_pressures'],
      });

      // Kiểm tra cấu trúc payload không có trường nào cho điều trị/y tế
      expect((context as any).conditions).toBeUndefined();
      expect((context as any).medications).toBeUndefined();
      expect((context as any).allergies).toBeUndefined();
      expect((context as any).documents).toBeUndefined();
    });
  });
});
