import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Plus } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { DashboardStatsSection } from '@/components/dashboard/DashboardStatsSection';
import { DashboardGoalsSection } from '@/components/dashboard/DashboardGoalsSection';
import { DashboardMetricsSection } from '@/components/dashboard/DashboardMetricsSection';
import { DashboardActivitiesSection } from '@/components/dashboard/DashboardActivitiesSection';
import { DashboardAISummaryCard } from '@/components/dashboard/DashboardAISummaryCard';
import {
  GoalEntity,
  ObservationEntity,
  ActivityEntity,
  AISummaryEntity,
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
              <span>Tổng quan luyện tập</span>
            </h1>
            <p className="text-xs text-slate-500">
              Dữ liệu tự khai & tổng hợp quá trình vận động cá nhân
            </p>
          </div>
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

  // Chuẩn bị mốc 7 ngày cho thống kê
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 3. Tải song song dữ liệu từ database qua RLS
  // Tách riêng truy vấn thống kê 7 ngày: is_planned = false, start_at trong 7 ngày gần nhất, không giới hạn số dòng.
  const [
    profileRes,
    goalsRes,
    observationsRes,
    activitiesRes,
    statsActivitiesRes,
    aiSummaryRes,
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
    supabase.from('ai_summaries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
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

  return (
    <div className="p-4 space-y-4">
      {/* Header trang & Chào mừng */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-emerald-600" />
            <span>Tổng quan luyện tập</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chào mừng trở lại, <span className="font-semibold text-slate-700 dark:text-slate-300">{displayName}</span>
          </p>
        </div>
        <Link
          href="/activities"
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ghi hoạt động</span>
        </Link>
      </div>

      {/* 1. Khối số liệu tổng hợp tuần (tính từ statsActivities, không giới hạn 10 dòng) */}
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

      {/* 3. Chỉ số tự khai (Đánh dấu rõ dữ liệu còn thiếu, KHÔNG hiển thị 0) */}
      <DashboardMetricsSection
        observations={observations}
        metricsError={observationsRes.error ? 'Không tải được chỉ số thể chất, thử lại sau.' : null}
      />

      {/* 4. Tóm tắt AI mới nhất */}
      <DashboardAISummaryCard
        latestSummary={latestSummary}
        aiError={aiSummaryRes.error ? 'Không tải được tóm tắt AI, thử lại sau.' : null}
      />

      {/* 5. Nhật ký hoạt động gần đây (Chỉ đọc, tối đa 10 bản ghi gần nhất) */}
      <DashboardActivitiesSection
        activities={recentActivities}
        activitiesError={activitiesRes.error ? 'Không tải được nhật ký hoạt động, thử lại sau.' : null}
      />
    </div>
  );
}
