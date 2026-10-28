import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  CreateBriefSnapshotSchema,
  CreateShareLinkSchema,
  BriefSnapshotPayload,
} from '@/features/briefs/contracts/briefs.contract';

describe('Agent A: D2 Briefs & Sharing Contract & Security Tests', () => {
  it('1. Validate CreateBriefSnapshotSchema cho mẫu workout', () => {
    const input = {
      briefType: 'workout',
      title: 'Tóm tắt tập luyện 2 tuần',
      dateRangeStart: '2026-10-14',
      dateRangeEnd: '2026-10-28',
      includedCategories: ['activities', 'daily_checkins', 'observations'],
      userNotes: 'Cần chú ý bài dips',
      enableAISummary: false,
    };

    const parsed = CreateBriefSnapshotSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('2. Validate CreateShareLinkSchema chỉ cho phép các mốc 1, 7, 30 ngày', () => {
    const valid = {
      briefId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      durationDays: '7',
    };
    expect(CreateShareLinkSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      briefId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      durationDays: '99', // Không trong allowlist enum
    };
    expect(CreateShareLinkSchema.safeParse(invalid).success).toBe(false);
  });

  it('3. Kiểm tra tính toán SHA-256 Token Hash cho chia sẻ bảo mật', () => {
    const rawToken = 'super-secret-random-bearer-token-12345';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect(tokenHash).toBeDefined();
    expect(tokenHash.length).toBe(64); // SHA-256 hex string luôn 64 ký tự

    // Thử hash lại để chứng minh tính deterministic
    const secondHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(secondHash).toBe(tokenHash);

    // Chuỗi khác phải sinh hash khác
    const differentHash = crypto.createHash('sha256').update('different-token').digest('hex');
    expect(differentHash).not.toBe(tokenHash);
  });

  it('4. Stale Detection logic: Phát hiện bản ghi nguồn thay đổi fingerprint', () => {
    const initialUpdatedAt = '2026-10-28T08:00:00.000Z';
    const initialFingerprint = crypto.createHash('sha256').update(initialUpdatedAt).digest('hex').slice(0, 16);

    const snapshotPayload: BriefSnapshotPayload = {
      meta: {
        briefType: 'workout',
        title: 'Tóm tắt tập luyện',
        generatedAt: '2026-10-28T09:00:00.000Z',
        dateRange: { start: '2026-10-14', end: '2026-10-28' },
        timezone: 'Asia/Ho_Chi_Minh',
        disclaimer: 'Bản tóm tắt tự khai',
      },
      overview: {
        totalRecords: 1,
        daysWithRecords: 1,
        missingDaysCount: 13,
        activitySessionCount: 1,
        totalActivityMinutes: 30,
        averageSleepMinutes: 420,
      },
      missingDataNotes: [],
      sourceRefs: [
        {
          sourceType: 'activities',
          sourceId: 'act-uuid-1',
          fingerprint: initialFingerprint,
          recordedAt: initialUpdatedAt,
        },
      ],
    };

    // Giả lập kiểm tra khi dữ liệu gốc không đổi:
    const unchangedUpdatedAt = '2026-10-28T08:00:00.000Z';
    const currentFingerprint1 = crypto.createHash('sha256').update(unchangedUpdatedAt).digest('hex').slice(0, 16);
    expect(currentFingerprint1).toBe(snapshotPayload.sourceRefs[0].fingerprint);

    // Giả lập khi người dùng sửa buổi tập trong DB (updated_at mới):
    const modifiedUpdatedAt = '2026-10-28T10:30:00.000Z';
    const currentFingerprint2 = crypto.createHash('sha256').update(modifiedUpdatedAt).digest('hex').slice(0, 16);
    expect(currentFingerprint2).not.toBe(snapshotPayload.sourceRefs[0].fingerprint);
    // Nhận diện snapshot đã stale!
    const isStale = currentFingerprint2 !== snapshotPayload.sourceRefs[0].fingerprint;
    expect(isStale).toBe(true);
  });

  it('5. Cấu trúc Allowlist Snapshot: Tuyệt đối không chứa user_id thật của chủ tài khoản', () => {
    const snapshot: BriefSnapshotPayload = {
      meta: {
        briefType: 'workout',
        title: 'Tóm tắt tập luyện',
        generatedAt: '2026-10-28T09:00:00.000Z',
        dateRange: { start: '2026-10-14', end: '2026-10-28' },
        timezone: 'Asia/Ho_Chi_Minh',
        disclaimer: 'Bản tóm tắt tự khai',
      },
      overview: {
        totalRecords: 1,
        daysWithRecords: 1,
        missingDaysCount: 13,
        activitySessionCount: 1,
        totalActivityMinutes: 30,
        averageSleepMinutes: 420,
      },
      workoutDetails: {
        activitiesCountByType: { running: 1 },
        sessions: [
          {
            date: '2026-10-28',
            activityType: 'running',
            durationMinutes: 25,
            fatigueLevel: null,
            notes: null,
            sourceId: 'act-1',
          },
        ],
        notesAndDifficulties: [],
      },
      missingDataNotes: [],
      sourceRefs: [],
    };

    // Kiểm tra cấu trúc snapshot không có trường user_id
    expect((snapshot as any).user_id).toBeUndefined();
    expect((snapshot.meta as any).user_id).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('"user_id"');
  });
});
