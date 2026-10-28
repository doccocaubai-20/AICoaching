import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  Dumbbell,
  ArrowRight,
  Clock,
  Sparkles,
  CalendarCheck2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ResumeWorkoutCard } from '@/features/workout/components/ResumeWorkoutCard';
import { WorkoutRunEntity } from '@/features/workout/contracts/workout.contract';
import { selectDashboardAction } from '@/lib/dashboard/dashboard-action-selector';
import {
  DEFAULT_APP_TIMEZONE,
  getLocalDateStartInstant,
  getLocalDateString,
  getPastLocalDateString,
} from '@/lib/date-utils';
import { ActivityEntity, DailyCheckinEntity } from '@/contracts';

interface DashboardPageProps {
  searchParams?: Promise<{
    intent?: string;
    [key: string]: string | string[] | undefined;
  }>;
}

export default async function DashboardPage(props: DashboardPageProps): Promise<React.ReactElement>;
export default async function DashboardPage(): Promise<React.ReactElement>;
export default async function DashboardPage(props?: DashboardPageProps): Promise<React.ReactElement> {
  const searchParams = props?.searchParams;
  const resolvedParams = searchParams ? await searchParams : {};
  const userIntent = (resolvedParams.intent as any) || null;
  const envStatus = getSupabaseEnvStatus();

  // 1. Trường hợp chưa cấu hình credentials
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
          <LayoutDashboard className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Chưa kết nối máy chủ</h2>
          <p className="text-xs text-slate-500">Vui lòng cấu hình biến môi trường Supabase để bắt đầu sử dụng.</p>
        </div>
      </div>
    );
  }

  // 2. Xác thực phiên đăng nhập
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  const { data: healthProfile } = await supabase
    .from('health_profiles')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle();

  const userTimezone = healthProfile?.timezone || DEFAULT_APP_TIMEZONE;
  const now = new Date();
  const sevenDaysAgo = getLocalDateStartInstant(getPastLocalDateString(6, now, userTimezone), userTimezone);
  const todayDateStr = getLocalDateString(now, userTimezone);

  // 3. Tải dữ liệu server
  let hasQueryError = false;
  let queryErrorMessage: string | null = null;
  let activeWorkout: WorkoutRunEntity | null = null;
  let todayActivity: ActivityEntity | null = null;
  let latestActivity: ActivityEntity | null = null;
  let totalActivitiesCount = 0;
  let statsActivities: ActivityEntity[] = [];
  let todayCheckin: DailyCheckinEntity | null = null;
  let displayName = 'Bạn';

  try {
    const [
      profileRes,
      activitiesRes,
      statsActivitiesRes,
      todayCheckinRes,
      activeWorkoutRes,
      totalCountRes,
    ] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_at', { ascending: false })
        .limit(5),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_planned', false)
        .gte('start_at', sevenDaysAgo.toISOString())
        .lte('start_at', now.toISOString()),
      supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('local_date', todayDateStr)
        .maybeSingle(),
      (async () => {
        try {
          let q = (supabase as any)
            .from('workout_runs')
            .select('*')
            .eq('user_id', user.id);
          if (typeof q.in === 'function') {
            q = q.in('status', ['in_progress', 'paused']);
          } else if (typeof q.or === 'function') {
            q = q.or('status.eq.in_progress,status.eq.paused');
          }
          return await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
        } catch {
          return { data: null };
        }
      })(),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    displayName =
      profileRes.data?.display_name ||
      user.user_metadata?.display_name ||
      'Bạn';

    const recentList = (activitiesRes.data as ActivityEntity[]) || [];
    latestActivity = recentList[0] || null;

    // Kiểm tra hoạt động hôm nay
    todayActivity =
      recentList.find((a) => {
        const actDateStr = getLocalDateString(new Date(a.start_at), userTimezone);
        return actDateStr === todayDateStr;
      }) || null;

    statsActivities = (statsActivitiesRes.data as ActivityEntity[]) || [];
    todayCheckin = (todayCheckinRes.data as DailyCheckinEntity) || null;
    activeWorkout = (activeWorkoutRes?.data as unknown as WorkoutRunEntity) || null;
    totalActivitiesCount = totalCountRes.count ?? recentList.length;
  } catch (err: any) {
    hasQueryError = true;
    queryErrorMessage = err?.message || 'Lỗi đọc dữ liệu trạng thái.';
  }

  // 4. Áp dụng Module quyết định thuần túy theo trạng thái server
  const recommendation = selectDashboardAction({
    hasError: hasQueryError,
    errorMessage: queryErrorMessage,
    activeWorkout: activeWorkout
      ? {
          id: activeWorkout.id,
          routineTitle: (activeWorkout as any).routine_title || 'Buổi tập calisthenics',
          completedSetsCount: (activeWorkout as any).completed_sets_count,
          totalSetsCount: (activeWorkout as any).total_sets_count,
          updatedAt: activeWorkout.updated_at,
        }
      : null,
    userIntent,
    totalActivitiesCount,
    hasTodayActivity: !!todayActivity,
    todayActivity: todayActivity
      ? {
          id: todayActivity.id,
          activityType: todayActivity.activity_type,
          durationMinutes: todayActivity.duration_minutes,
          startAt: todayActivity.start_at,
          notes: todayActivity.notes,
        }
      : null,
    latestActivity: latestActivity
      ? {
          id: latestActivity.id,
          activityType: latestActivity.activity_type,
          durationMinutes: latestActivity.duration_minutes,
          startAt: latestActivity.start_at,
          notes: latestActivity.notes,
        }
      : null,
    todayCheckin: todayCheckin
      ? {
          id: todayCheckin.id,
          sleepDurationMinutes: todayCheckin.sleep_duration_minutes,
          energyLevel: todayCheckin.energy_level,
        }
      : null,
  });

  const { primaryAction, secondaryActions, recentRecord, showWeekReview } = recommendation;

  // Tính tổng số phút và buổi trong 7 ngày
  const weekTotalMinutes = statsActivities.reduce((acc, act) => acc + act.duration_minutes, 0);
  const weekTotalSessions = statsActivities.length;

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">
      {/* Header Chào mừng & Ngày hôm nay */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Hôm nay</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chào mừng trở lại, <span className="font-semibold text-slate-700 dark:text-slate-300">{displayName}</span>
          </p>
        </div>

        <Link
          href="/me"
          className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
        >
          Cá nhân
        </Link>
      </div>

      {/* KHỐI 1: VIỆC CHÍNH PHÙ HỢP TRẠNG THÁI (PRIMARY ACTION) */}
      {primaryAction.variant === 'resume_workout' && activeWorkout ? (
        <section aria-label="Buổi tập đang dang dở">
          <ResumeWorkoutCard run={activeWorkout} />
        </section>
      ) : (
        <section
          aria-label="Hành động đề xuất chính"
          className="p-5 sm:p-6 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl shadow-md space-y-4"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-[11px] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhiệm vụ hôm nay</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black leading-snug">{primaryAction.title}</h2>
            <p className="text-xs text-emerald-100 leading-relaxed">{primaryAction.reason}</p>
          </div>

          <div className="pt-1">
            <Link
              href={primaryAction.ctaHref}
              className="w-full py-3 px-4 bg-white text-emerald-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition shadow-sm"
            >
              <span>{primaryAction.ctaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {secondaryActions.length > 0 && (
            <div className="pt-2 border-t border-white/20 flex flex-wrap gap-2">
              {secondaryActions.map((sec) => (
                <Link
                  key={sec.id}
                  href={sec.href}
                  className="text-[11px] font-medium text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition"
                >
                  {sec.label} &rarr;
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* KHỐI 2: BẢN GHI / KẾT QUẢ GẦN NHẤT (RECENT RECORD) */}
      {recentRecord && (
        <section
          aria-label="Bản ghi gần nhất"
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {recentRecord.timeLabel}
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                {recentRecord.title}
              </div>
            </div>
          </div>

          <Link
            href={recentRecord.viewHref}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Xem lại</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </section>
      )}

      {/* KHỐI 3: NHÌN LẠI TUẦN & KHÁM PHÁ (WEEKLY REVIEW & EXPLORE) */}
      <section
        aria-label="Nhìn lại tuần"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Nhìn lại 7 ngày qua
            </h3>
          </div>
          <Link href="/activities" className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            Xem nhật ký &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-xl font-black text-slate-900 dark:text-white">{weekTotalSessions}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Buổi vận động</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{weekTotalMinutes}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Tổng số phút</div>
          </div>
        </div>

        {/* Khám phá phụ theo ngữ cảnh (Progressive Disclosure) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span>Hộ chiếu & QR:</span>
            <Link href="/passport" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Hộ chiếu thể thao
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <span>Trao đổi:</span>
            <Link href="/briefs" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Bản tóm tắt
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
