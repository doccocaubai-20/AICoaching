import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';
import { ActivityEntity, GoalEntity } from '@/contracts';
import { calculateStreakDays } from '@/lib/passport/passport-utils';

export const metadata = {
  title: 'Thẻ Căn Cước Vận Động (Passport) | CalisCoaching',
  description: 'Thẻ hồ sơ rèn luyện và năng lực thể chất cá nhân hóa',
};

export const dynamic = 'force-dynamic';

function unavailableSharedPassport(): React.ReactElement {
  return (
    <div className="p-4 max-w-sm mx-auto">
      <div className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-700 dark:text-slate-300">
        <div className="font-bold text-slate-900 dark:text-slate-100">Liên kết hồ sơ không còn khả dụng</div>
        <p className="mt-2">Chủ hồ sơ có thể đã thu hồi liên kết hoặc đường dẫn không hợp lệ.</p>
      </div>
    </div>
  );
}

async function renderSharedPassport(token: string): Promise<React.ReactElement> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return unavailableSharedPassport();
  const adminClient = createAdminSupabaseClient();
  if (!adminClient) return unavailableSharedPassport();

  const { data: share, error: shareError } = await adminClient
    .from('athlete_passport_shares')
    .select('user_id')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle();
  if (shareError || !share) return unavailableSharedPassport();

  const [profileRes, activitiesRes, goalsRes, healthProfileRes] = await Promise.all([
    adminClient.from('profiles').select('user_id, display_name, experience_level').eq('user_id', share.user_id).maybeSingle(),
    adminClient.from('activities').select('id, start_at, duration_minutes, is_planned').eq('user_id', share.user_id).eq('is_planned', false),
    adminClient.from('goals').select('status').eq('user_id', share.user_id),
    adminClient.from('health_profiles').select('timezone').eq('user_id', share.user_id).maybeSingle(),
  ]);
  if (profileRes.error || activitiesRes.error || goalsRes.error || !profileRes.data) {
    return unavailableSharedPassport();
  }

  const activities = (activitiesRes.data || []) as ActivityEntity[];
  const goals = goalsRes.data || [];
  const origin = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://caliscoaching.vn');

  return (
    <div className="p-4 space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">CalisCoaching</Link>
        <span className="text-xs font-bold text-slate-500">Hồ sơ được chủ tài khoản chia sẻ</span>
      </div>
      <AthletePassportCard
        userId={share.user_id}
        displayName={profileRes.data.display_name || 'Vận động viên'}
        totalSessions={activities.length}
        totalMinutes={activities.reduce((sum, activity) => sum + (activity.duration_minutes || 0), 0)}
        completedGoalsCount={goals.filter((goal) => goal.status === 'completed').length}
        streakDays={calculateStreakDays(activities, new Date(), healthProfileRes.data?.timezone || undefined)}
        shareableUrl={origin + '/passport?share=' + encodeURIComponent(token)}
        canManageShare={false}
        experienceLevel={profileRes.data.experience_level === 'advanced' ? 'Cấp độ Nâng Cao' : profileRes.data.experience_level === 'intermediate' ? 'Cấp độ Trung Cấp' : 'Cấp độ Tân Thủ'}
      />
    </div>
  );
}

export default async function PassportPage(): Promise<React.ReactElement>;
export default async function PassportPage(props: {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement>;
export default async function PassportPage(props?: {
  params?: Promise<Record<string, string | string[] | undefined>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const resolvedParams = props?.searchParams ? await Promise.resolve(props.searchParams) : undefined;
  const rawShare = resolvedParams?.share;
  const shareToken = typeof rawShare === 'string' ? rawShare : undefined;
  if (shareToken) return renderSharedPassport(shareToken);

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

  const targetUserId = user.id;

  // Tải thông tin người dùng, hoạt động và mục tiêu
  const [profileRes, activitiesRes, goalsRes, healthProfileRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('activities').select('*').eq('user_id', targetUserId).eq('is_planned', false),
    supabase.from('goals').select('*').eq('user_id', targetUserId),
    supabase.from('health_profiles').select('timezone').eq('user_id', targetUserId).maybeSingle(),
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

  const displayName =
    profileRes.data?.display_name ||
    user.user_metadata?.display_name ||
    'Vận Động Viên';

  const activities = (activitiesRes.data as ActivityEntity[]) || [];
  const goals = (goalsRes.data as GoalEntity[]) || [];

  const totalSessions = activities.length;
  const totalMinutes = activities.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;
  const streakDays = calculateStreakDays(activities, new Date(), healthProfileRes.data?.timezone || undefined);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://caliscoaching.vn');
  const { data: share } = await supabase
    .from('athlete_passport_shares')
    .select('token')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();
  const shareableUrl = share?.token
    ? `${origin}/passport?share=${encodeURIComponent(share.token)}`
    : '';

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
          <span>Hồ Sơ Vận Động</span>
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
        canManageShare={true}
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
