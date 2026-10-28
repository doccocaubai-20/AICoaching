import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  HeartPulse,
  ArrowRight,
  Sparkles,
  BotMessageSquare,
  Zap,
  Users,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { DashboardStatsSection } from '@/components/dashboard/DashboardStatsSection';
import { DashboardGoalsSection } from '@/components/dashboard/DashboardGoalsSection';
import { DashboardMetricsSection } from '@/components/dashboard/DashboardMetricsSection';
import { DashboardActivitiesSection } from '@/components/dashboard/DashboardActivitiesSection';
import { DashboardAISummaryCard } from '@/components/dashboard/DashboardAISummaryCard';
import { QuickCheckinWidget } from '@/components/health/QuickCheckinWidget';
import { QuickCaptureLauncher } from '@/features/capture/components/QuickCaptureLauncher';
import { ResumeWorkoutCard } from '@/features/workout/components/ResumeWorkoutCard';
import { WorkoutRunEntity } from '@/features/workout/contracts/workout.contract';
import { JourneySummaryCard } from '@/features/skills/components/JourneySummaryCard';
import { getJourneySummary } from '@/features/skills/server/skills-actions';
import { GroupWeekSummaryCard } from '@/components/groups/GroupWeekSummaryCard';
import { GroupWeekSummaryExport, exportGroupWeekSummary } from '@/contracts/group.contract';
import {
  DEFAULT_APP_TIMEZONE,
  getLocalDateStartInstant,
  getLocalDateString,
  getPastLocalDateString,
} from '@/lib/date-utils';
import {
  GoalEntity,
  ObservationEntity,
  ActivityEntity,
  AISummaryEntity,
  DailyCheckinEntity,
} from '@/contracts';

export default async function DashboardPage() {
  const envStatus = getSupabaseEnvStatus();

  // 1. Trường hợp chưa cấu hình credentials
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-emerald-600" />
              <span>Hôm nay</span>
            </h1>
            <p className="text-xs text-slate-500">
              Dữ liệu tự khai & tổng hợp quá trình vận động cá nhân
            </p>
          </div>
          <Link
            href="/passport"
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thẻ Passport</span>
          </Link>
        </div>

        {/* Chưa cấu hình Supabase: không hiện 0 buổi / 0 phút, hiện "—" kèm "Chưa có dữ liệu" */}
        <DashboardStatsSection activities={[]} isConfigured={false} />
        <DashboardGoalsSection goals={[]} />
        <DashboardMetricsSection observations={[]} />
        <DashboardAISummaryCard latestSummary={null} />
        <DashboardActivitiesSection activities={[]} />
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

  // 3. Tải song song dữ liệu từ database qua RLS
  const [
    profileRes,
    goalsRes,
    observationsRes,
    activitiesRes,
    statsActivitiesRes,
    aiSummaryRes,
    todayCheckinRes,
    activeWorkoutRes,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('observations').select('*').eq('user_id', user.id).order('observed_at', { ascending: false }),
    supabase.from('activities').select('*').eq('user_id', user.id).order('start_at', { ascending: false }).limit(10),
    supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_planned', false)
      .gte('start_at', sevenDaysAgo.toISOString())
      .lte('start_at', now.toISOString()),
    supabase
      .from('ai_summaries')
      .select('*')
      .eq('user_id', user.id)
      .or('input_scope->>kind.is.null,input_scope->>kind.neq.analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  ]);

  const displayName =
    profileRes.data?.display_name ||
    user.user_metadata?.display_name ||
    'Người dùng mới';

  const goals = (goalsRes.data as GoalEntity[]) || [];
  const observations = (observationsRes.data as ObservationEntity[]) || [];
  const recentActivities = (activitiesRes.data as ActivityEntity[]) || [];
  const statsActivities = (statsActivitiesRes.data as ActivityEntity[]) || [];
  const latestSummary = (aiSummaryRes.data as AISummaryEntity) || null;
  const todayCheckin = (todayCheckinRes.data as DailyCheckinEntity) || null;
  const activeWorkout = (activeWorkoutRes?.data as unknown as WorkoutRunEntity) || null;

  // Lấy tóm tắt kỹ năng (Agent C)
  let journeySummary = null;
  try {
    journeySummary = await getJourneySummary(user.id);
  } catch {
    journeySummary = null;
  }

  // Lấy tóm tắt nhóm đồng hành (Agent D)
  let groupSummary: GroupWeekSummaryExport | null = null;
  try {
    const { data: memberOf } = await (supabase as any)
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (memberOf?.group_id) {
      const { data: grp } = await (supabase as any)
        .from('groups')
        .select('id, name')
        .eq('id', memberOf.group_id)
        .maybeSingle();

      if (grp) {
        const [membersRes, commitsRes] = await Promise.all([
          (supabase as any)
            .from('group_members')
            .select('id')
            .eq('group_id', grp.id)
            .eq('status', 'active'),
          (supabase as any)
            .from('weekly_commitments')
            .select('*')
            .eq('group_id', grp.id),
        ]);

        groupSummary = exportGroupWeekSummary(
          { id: grp.id, name: grp.name, timezone: userTimezone },
          commitsRes.data || [],
          todayDateStr,
          (membersRes.data || []).length
        );
      }
    }
  } catch {
    groupSummary = null;
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header trang & Chào mừng */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Hôm nay</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chào mừng trở lại, <span className="font-semibold text-slate-700 dark:text-slate-300">{displayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/capture"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Ghi 1 câu</span>
          </Link>
          <Link
            href="/activities"
            className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thủ công</span>
          </Link>
        </div>
      </div>

      {/* Ưu tiên 1 (Server State): Buổi tập đang dở (Agent B - D3) */}
      {activeWorkout && (
        <section aria-label="Buổi tập đang diễn ra">
          <ResumeWorkoutCard run={activeWorkout} />
        </section>
      )}

      {/* Lối vào AI nhất quán: Nút Hỏi về dữ liệu của tôi */}
      <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 border border-teal-500/20 dark:border-teal-500/30 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center">
            <BotMessageSquare className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Trợ lý Hỏi đáp & Phân tích</p>
            <p className="text-[11px] text-slate-500">Đặt câu hỏi có kiểm chứng nguồn và consent</p>
          </div>
        </div>
        <Link
          href="/ai"
          className="text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 font-semibold px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 transition flex items-center gap-1 shadow-xs"
        >
          <span>Mở Trợ lý</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Ưu tiên 2: Trình ghi nhanh một câu (Agent A - D1) */}
      <QuickCaptureLauncher variant="banner" />

      {/* Micro-interaction: Check-in Sinh Hoạt Nhanh 10 Giây */}
      <QuickCheckinWidget
        todayCheckin={todayCheckin}
        todayDateStr={todayDateStr}
        isConfigured={true}
      />

      {/* Lối tắt: Sức Khỏe V2 & Thẻ Athlete Passport */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/health"
          className="block bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white rounded-2xl p-3.5 shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>Hồ Sơ Sức Khỏe V2</span>
                  <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded font-semibold">Mới</span>
                </p>
                <p className="text-[10px] text-white/80">
                  Huyết áp, chấn thương, thuốc & an toàn
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/passport"
          className="block bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-950 hover:from-indigo-800 hover:to-emerald-900 text-white rounded-2xl p-3.5 shadow-sm border border-emerald-500/30 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 backdrop-blur border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span className="text-emerald-300">Athlete Passport</span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">Căn Cước</span>
                </p>
                <p className="text-[10px] text-slate-300">
                  Thẻ định danh rèn luyện & mã QR chia sẻ
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Ưu tiên 3 & 4: Cam kết nhóm tuần (Agent D) & Hành trình kỹ năng có bằng chứng (Agent C) */}
      <div className="space-y-3">
        {groupSummary ? (
          <GroupWeekSummaryCard summary={groupSummary} />
        ) : (
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Nhóm đồng hành 3–5 người</p>
                <p className="text-[11px] text-slate-500">Giữ cam kết riêng, không áp lực bảng xếp hạng</p>
              </div>
            </div>
            <Link
              href="/groups"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              <span>Tham gia</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Hành trình kỹ năng (D4 + D6) */}
        <JourneySummaryCard summary={journeySummary} />
      </div>

      {/* 1. Khối số liệu tổng hợp tuần */}
      <DashboardStatsSection
        activities={statsActivities}
        isConfigured={true}
        statsError={statsActivitiesRes.error ? 'Không tải được số liệu thống kê, thử lại sau.' : null}
      />

      {/* 2. Mục tiêu đang diễn ra */}
      <DashboardGoalsSection
        goals={goals}
        goalsError={goalsRes.error ? 'Không tải được mục tiêu, thử lại sau.' : null}
      />

      {/* 3. Chỉ số tự khai */}
      <DashboardMetricsSection
        observations={observations}
        metricsError={observationsRes.error ? 'Không tải được chỉ số thể chất, thử lại sau.' : null}
      />

      {/* 4. Tóm tắt AI mới nhất */}
      <DashboardAISummaryCard
        latestSummary={latestSummary}
        aiError={aiSummaryRes.error ? 'Không tải được tóm tắt AI, thử lại sau.' : null}
      />

      {/* 5. Nhật ký hoạt động gần đây */}
      <DashboardActivitiesSection
        activities={recentActivities}
        activitiesError={activitiesRes.error ? 'Không tải được nhật ký hoạt động, thử lại sau.' : null}
      />
    </div>
  );
}
