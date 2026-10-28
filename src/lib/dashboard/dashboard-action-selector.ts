/**
 * CALISCOACHING - STATE-DRIVEN DASHBOARD ACTION SELECTOR
 * Module quyết định thuần túy (pure function) nhận dữ liệu trạng thái từ server
 * và trả về hành động chính, nhãn, lý do ngắn và các hành động phụ phù hợp.
 * 
 * Tuân thủ quy tắc ưu tiên tại mục 5:
 * 1. Đang tải -> Skeleton / loading
 * 2. Lỗi đọc trạng thái -> Thử tải lại (không biến lỗi thành tài khoản trống)
 * 3. Có workout đang dở -> Tiếp tục buổi tập
 * 4. Có đích vừa chọn trong luồng mới -> Tiếp tục việc đã chọn
 * 5. Chưa có bản ghi nào, không có việc dở -> Ghi hoạt động đầu tiên
 * 6. Có bản ghi trước đây, hôm nay chưa ghi -> Ghi lại hôm nay
 * 7. Hôm nay đã ghi, không có việc dở -> Xem kết quả hôm nay
 */

export interface DashboardServerState {
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string | null;
  activeWorkout?: {
    id: string;
    routineTitle?: string;
    completedSetsCount?: number;
    totalSetsCount?: number;
    updatedAt?: string;
  } | null;
  userIntent?: 'record_activity' | 'start_workout' | 'track_health' | null;
  totalActivitiesCount: number;
  hasTodayActivity: boolean;
  todayActivity?: {
    id: string;
    activityType: string;
    durationMinutes: number;
    startAt: string;
    notes?: string | null;
  } | null;
  latestActivity?: {
    id: string;
    activityType: string;
    durationMinutes: number;
    startAt: string;
    notes?: string | null;
  } | null;
  todayCheckin?: {
    id: string;
    sleepDurationMinutes?: number | null;
    energyLevel?: number | null;
  } | null;
}

export interface DashboardPrimaryAction {
  id: string;
  title: string;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
  variant:
    | 'loading'
    | 'error'
    | 'resume_workout'
    | 'user_intent'
    | 'first_activity'
    | 'record_today'
    | 'view_today';
}

export interface DashboardActionRecommendation {
  primaryAction: DashboardPrimaryAction;
  secondaryActions: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  recentRecord: {
    type: string;
    title: string;
    timeLabel: string;
    viewHref: string;
  } | null;
  showWeekReview: boolean;
}

export function selectDashboardAction(state: DashboardServerState): DashboardActionRecommendation {
  // 1. Đang tải
  if (state.isLoading) {
    return {
      primaryAction: {
        id: 'loading',
        title: 'Đang tải dữ liệu hồ sơ...',
        reason: 'Hệ thống đang đồng bộ dữ liệu rèn luyện của bạn.',
        ctaLabel: 'Đang tải...',
        ctaHref: '#',
        variant: 'loading',
      },
      secondaryActions: [],
      recentRecord: null,
      showWeekReview: false,
    };
  }

  // 2. Lỗi đọc trạng thái
  if (state.hasError) {
    return {
      primaryAction: {
        id: 'error_retry',
        title: 'Không thể tải trạng thái hôm nay',
        reason: state.errorMessage || 'Đã có sự cố khi kết nối tới máy chủ. Vui lòng thử tải lại.',
        ctaLabel: 'Tải lại trang',
        ctaHref: '/dashboard',
        variant: 'error',
      },
      secondaryActions: [
        { id: 'go_activities', label: 'Xem nhật ký', href: '/activities' },
      ],
      recentRecord: null,
      showWeekReview: false,
    };
  }

  // 3. Có workout đang dở
  if (state.activeWorkout) {
    const setsInfo =
      state.activeWorkout.completedSetsCount !== undefined && state.activeWorkout.totalSetsCount
        ? ` (Hiệp ${state.activeWorkout.completedSetsCount}/${state.activeWorkout.totalSetsCount})`
        : '';
    const workoutName = state.activeWorkout.routineTitle || 'Buổi tập calisthenics';

    return {
      primaryAction: {
        id: 'resume_workout',
        title: `Tiếp tục: ${workoutName}${setsInfo}`,
        reason: 'Bạn có một buổi tập đang tạm dừng. Tiếp tục để lưu kết quả các hiệp còn lại.',
        ctaLabel: 'Tiếp tục buổi tập ngay',
        ctaHref: `/workout/${state.activeWorkout.id}`,
        variant: 'resume_workout',
      },
      secondaryActions: [
        { id: 'record_quick', label: 'Ghi nhanh việc khác', href: '/capture' },
        { id: 'view_history', label: 'Nhật ký tập luyện', href: '/activities' },
      ],
      recentRecord: state.latestActivity
        ? {
            type: 'activity',
            title: `${state.latestActivity.activityType} (${state.latestActivity.durationMinutes} phút)`,
            timeLabel: 'Buổi tập trước',
            viewHref: '/activities',
          }
        : null,
      showWeekReview: true,
    };
  }

  // 4. Có đích vừa chọn trong luồng mới (User Intent)
  if (state.userIntent === 'start_workout') {
    return {
      primaryAction: {
        id: 'intent_workout',
        title: 'Bắt đầu buổi tập hôm nay',
        reason: 'Bạn đã chọn mục tiêu luyện tập. Hãy chọn một buổi mẫu phù hợp để bắt đầu.',
        ctaLabel: 'Chọn buổi tập',
        ctaHref: '/programs',
        variant: 'user_intent',
      },
      secondaryActions: [
        { id: 'record_done', label: 'Tôi đã tập xong rồi (Ghi nhận)', href: '/capture' },
      ],
      recentRecord: null,
      showWeekReview: false,
    };
  }

  if (state.userIntent === 'track_health') {
    return {
      primaryAction: {
        id: 'intent_health',
        title: 'Ghi nhận giấc ngủ hoặc chỉ số hôm nay',
        reason: 'Theo dõi sự thay đổi của cơ thể qua các chỉ số tự khai đơn giản.',
        ctaLabel: 'Ghi chỉ số / giấc ngủ',
        ctaHref: '/capture',
        variant: 'user_intent',
      },
      secondaryActions: [
        { id: 'start_workout', label: 'Bắt đầu tập luyện', href: '/programs' },
      ],
      recentRecord: null,
      showWeekReview: false,
    };
  }

  // 5. Chưa có bản ghi nào, không có việc dở
  if (state.totalActivitiesCount === 0 && !state.todayActivity) {
    return {
      primaryAction: {
        id: 'first_activity',
        title: 'Ghi hoạt động đầu tiên của bạn',
        reason: 'Nhập một câu tiếng Việt hoặc chọn form ngắn để lưu lại hoạt động bạn vừa hoàn thành.',
        ctaLabel: 'Ghi lại việc vừa làm',
        ctaHref: '/capture',
        variant: 'first_activity',
      },
      secondaryActions: [
        { id: 'start_workout', label: 'Tôi muốn bắt đầu tập ngay', href: '/programs' },
        { id: 'track_health', label: 'Theo dõi giấc ngủ / cân nặng', href: '/capture' },
      ],
      recentRecord: null,
      showWeekReview: false,
    };
  }

  // 6. Hôm nay đã có bản ghi
  if (state.hasTodayActivity && state.todayActivity) {
    return {
      primaryAction: {
        id: 'view_today',
        title: `Đã ghi nhận hôm nay: ${state.todayActivity.activityType} (${state.todayActivity.durationMinutes} phút)`,
        reason: 'Bạn đã hoàn thành việc ghi nhận hoạt động hôm nay. Xem lại kết quả hoặc chuẩn bị cho ngày mai.',
        ctaLabel: 'Xem chi tiết trong Nhật ký',
        ctaHref: '/activities',
        variant: 'view_today',
      },
      secondaryActions: [
        { id: 'record_more', label: 'Ghi thêm hoạt động khác', href: '/capture' },
        { id: 'explore_skills', label: 'Khám phá kỹ năng', href: '/journey' },
      ],
      recentRecord: {
        type: 'activity',
        title: `${state.todayActivity.activityType} · ${state.todayActivity.durationMinutes} phút`,
        timeLabel: 'Hôm nay',
        viewHref: '/activities',
      },
      showWeekReview: true,
    };
  }

  // 7. Có bản ghi trước đây, hôm nay chưa ghi
  return {
    primaryAction: {
      id: 'record_today',
      title: 'Hôm nay bạn đã vận động gì chưa?',
      reason: 'Duy trì nhật ký đều đặn giúp bạn theo dõi sát sao sự tiến bộ theo thời gian.',
      ctaLabel: 'Ghi lại hôm nay',
      ctaHref: '/capture',
      variant: 'record_today',
    },
    secondaryActions: [
      { id: 'start_workout', label: 'Bắt đầu buổi tập', href: '/programs' },
      { id: 'view_history', label: 'Xem nhật ký', href: '/activities' },
    ],
    recentRecord: state.latestActivity
      ? {
          type: 'activity',
          title: `${state.latestActivity.activityType} · ${state.latestActivity.durationMinutes} phút`,
          timeLabel: 'Bản ghi gần nhất',
          viewHref: '/activities',
        }
      : null,
    showWeekReview: true,
  };
}
