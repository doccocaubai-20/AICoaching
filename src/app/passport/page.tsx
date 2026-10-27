import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';
import { ActivityEntity, GoalEntity } from '@/contracts';
import { calculateStreakDays, getActiveSharedCard } from '@/lib/passport/passport-utils';

export const metadata = {
  title: 'Thẻ Căn Cước Vận Động (Passport) | CalisCoaching',
  description: 'Thẻ hồ sơ rèn luyện và năng lực thể chất cá nhân hóa',
};

export default async function PassportPage(): Promise<React.ReactElement>;
export default async function PassportPage(props: {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement>;
export default async function PassportPage(props?: {
  params?: Promise<Record<string, string | string[] | undefined>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner isConfigured={false} missingKeys={envStatus.missingKeys} />
        <AthletePassportCard
          displayName="Vận Động Viên Demo"
          totalSessions={8}
          totalMinutes={240}
          completedGoalsCount={2}
          streakDays={5}
        />
      </div>
    );
  }

  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  const sharedCard = getActiveSharedCard();
  const resolvedParams = props?.searchParams ? await Promise.resolve(props.searchParams) : undefined;
  const rawU = resolvedParams?.u;
  const sharedU = typeof rawU === 'string' ? rawU : undefined;
  const isViewingShared = Boolean(sharedU && sharedU !== user.id);
  const targetUserId = sharedU || sharedCard?.userId || user.id;

  // Tải thông tin người dùng, hoạt động và mục tiêu
  const [profileRes, activitiesRes, goalsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('activities').select('*').eq('user_id', targetUserId).eq('is_planned', false),
    supabase.from('goals').select('*').eq('user_id', targetUserId),
  ]);

  // Kiểm tra lỗi đọc DB: Phải hiển thị lỗi rõ ràng, tuyệt đối không âm thầm cấp thẻ rỗng
  const readError = profileRes.error || activitiesRes.error || goalsRes.error;
  if (readError) {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Không tải được dữ liệu thẻ hồ sơ rèn luyện</span>
          </div>
          <p className="text-rose-700">
            Hệ thống không thể đọc dữ liệu thể chất từ cơ sở dữ liệu ({readError.message || 'Lỗi kết nối'}). Vui lòng thử lại sau.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-block py-2 px-3 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500 transition"
            >
              Quay lại Tổng quan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // [E1/E2] Khi xem thẻ chia sẻ mà RLS ẩn owner (hoặc không tìm thấy profile):
  // Phải hiển thị màn hình denied / not-found, tuyệt đối không ghép ID của A với tên của viewer B
  if (isViewingShared && !profileRes.data) {
    return (
      <div className="p-4 space-y-4 max-w-sm mx-auto">
        <div className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            <span>Thẻ rèn luyện không khả dụng hoặc chưa được chia sẻ công khai</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Hồ sơ vận động này không tồn tại hoặc bạn không có quyền xem dữ liệu rèn luyện của vận động viên này.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-block py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
            >
              Quay lại Tổng quan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    sharedCard?.displayName ||
    profileRes.data?.display_name ||
    user.user_metadata?.display_name ||
    'Vận Động Viên';

  const activities = (activitiesRes.data as ActivityEntity[]) || [];
  const goals = (goalsRes.data as GoalEntity[]) || [];

  const totalSessions = activities.length;
  const totalMinutes = activities.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;
  const streakDays = calculateStreakDays(activities);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://caliscoaching.vn');
  const shareableUrl = `${origin}/passport?u=${encodeURIComponent(targetUserId)}`;

  return (
    <div className="p-4 space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tổng quan</span>
        </Link>

        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Hồ Sơ Vận Động Chia Sẻ</span>
        </span>
      </div>

      <AthletePassportCard
        userId={targetUserId}
        displayName={displayName}
        totalSessions={totalSessions}
        totalMinutes={totalMinutes}
        completedGoalsCount={completedGoalsCount}
        streakDays={streakDays}
        shareableUrl={shareableUrl}
        experienceLevel={
          profileRes.data?.experience_level === 'advanced'
            ? 'Cấp độ Nâng Cao'
            : profileRes.data?.experience_level === 'intermediate'
            ? 'Cấp độ Trung Cấp'
            : 'Cấp độ Tân Thủ'
        }
      />
    </div>
  );
}
