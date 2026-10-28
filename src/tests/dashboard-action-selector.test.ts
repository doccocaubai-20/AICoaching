import { describe, it, expect } from 'vitest';
import {
  selectDashboardAction,
  DashboardServerState,
} from '@/lib/dashboard/dashboard-action-selector';

describe('P0: Dashboard State-Driven Action Selector Tests', () => {
  it('1. Đang tải dữ liệu -> Trả về primary action loading', () => {
    const state: DashboardServerState = {
      isLoading: true,
      totalActivitiesCount: 0,
      hasTodayActivity: false,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('loading');
    expect(action.showWeekReview).toBe(false);
  });

  it('2. Lỗi đọc trạng thái -> Trả về primary action error, không biến thành tài khoản trống', () => {
    const state: DashboardServerState = {
      hasError: true,
      errorMessage: 'Không thể kết nối máy chủ Supabase',
      totalActivitiesCount: 0,
      hasTodayActivity: false,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('error');
    expect(action.primaryAction.title).toContain('Không thể tải trạng thái');
    expect(action.primaryAction.ctaLabel).toBe('Tải lại trang');
  });

  it('3. Có workout đang dở -> Ưu tiên cao nhất: Tiếp tục buổi tập', () => {
    const state: DashboardServerState = {
      activeWorkout: {
        id: 'run-123',
        routineTitle: 'Calisthenics Cơ Bản',
        completedSetsCount: 3,
        totalSetsCount: 6,
      },
      totalActivitiesCount: 5,
      hasTodayActivity: false,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('resume_workout');
    expect(action.primaryAction.ctaHref).toBe('/workout/run-123');
    expect(action.primaryAction.title).toContain('Calisthenics Cơ Bản');
    expect(action.primaryAction.title).toContain('3/6');
  });

  it('4. Tài khoản hoàn toàn mới (0 bản ghi) -> Gợi ý Ghi hoạt động đầu tiên', () => {
    const state: DashboardServerState = {
      totalActivitiesCount: 0,
      hasTodayActivity: false,
      activeWorkout: null,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('first_activity');
    expect(action.primaryAction.ctaHref).toBe('/capture');
    expect(action.primaryAction.ctaLabel).toBe('Ghi lại việc vừa làm');
    expect(action.secondaryActions.some((s) => s.href === '/programs')).toBe(true);
    expect(action.recentRecord).toBeNull();
  });

  it('5. Hôm nay đã có hoạt động ghi nhận -> Xem kết quả hôm nay', () => {
    const state: DashboardServerState = {
      totalActivitiesCount: 4,
      hasTodayActivity: true,
      todayActivity: {
        id: 'act-today-1',
        activityType: 'chạy bộ',
        durationMinutes: 25,
        startAt: new Date().toISOString(),
      },
      activeWorkout: null,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('view_today');
    expect(action.primaryAction.title).toContain('chạy bộ (25 phút)');
    expect(action.primaryAction.ctaHref).toBe('/activities');
    expect(action.recentRecord).not.toBeNull();
    expect(action.recentRecord?.title).toContain('chạy bộ');
  });

  it('6. Đã có bản ghi cũ, hôm nay chưa ghi -> Ghi lại hôm nay', () => {
    const state: DashboardServerState = {
      totalActivitiesCount: 10,
      hasTodayActivity: false,
      latestActivity: {
        id: 'act-yesterday',
        activityType: 'calisthenics',
        durationMinutes: 45,
        startAt: new Date(Date.now() - 86400000).toISOString(),
      },
      activeWorkout: null,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('record_today');
    expect(action.primaryAction.ctaLabel).toBe('Ghi lại hôm nay');
    expect(action.recentRecord).not.toBeNull();
    expect(action.recentRecord?.title).toContain('calisthenics');
  });

  it('7. Người dùng chọn mục đích tập luyện (intent start_workout) -> Đưa tới Buổi tập', () => {
    const state: DashboardServerState = {
      totalActivitiesCount: 0,
      hasTodayActivity: false,
      userIntent: 'start_workout',
      activeWorkout: null,
    };
    const action = selectDashboardAction(state);
    expect(action.primaryAction.variant).toBe('user_intent');
    expect(action.primaryAction.ctaHref).toBe('/programs');
  });
});
