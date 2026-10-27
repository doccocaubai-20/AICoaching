import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { AthletePassportCard } from '@/components/passport/AthletePassportCard';
import { ActivityEntity, GoalEntity } from '@/contracts';

export const metadata = {
  title: 'Thẻ Căn Cước Vận Động (Passport) | CalisCoaching',
  description: 'Thẻ hồ sơ rèn luyện và năng lực thể chất cá nhân hóa',
};

export default async function PassportPage() {
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

  // Tải thông tin người dùng, hoạt động và mục tiêu
  const [profileRes, activitiesRes, goalsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('activities').select('*').eq('user_id', user.id).eq('is_planned', false),
    supabase.from('goals').select('*').eq('user_id', user.id),
  ]);

  const displayName = profileRes.data?.display_name || user.user_metadata?.display_name || 'Vận Động Viên';
  const activities = (activitiesRes.data as ActivityEntity[]) || [];
  const goals = (goalsRes.data as GoalEntity[]) || [];

  const totalSessions = activities.length;
  const totalMinutes = activities.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;

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
        displayName={displayName}
        totalSessions={totalSessions}
        totalMinutes={totalMinutes}
        completedGoalsCount={completedGoalsCount}
        streakDays={Math.min(14, Math.max(1, Math.round(totalSessions * 0.7)))}
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
