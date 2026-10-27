import React from 'react';
import { redirect } from 'next/navigation';
import { UserCheck } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { GoalsManager } from '@/components/profile/GoalsManager';
import { ObservationsManager } from '@/components/profile/ObservationsManager';
import { GoalEntity, ObservationEntity, ExperienceLevel, ProfileScheduleDay } from '@/contracts';

export default async function ProfilePage() {
  const envStatus = getSupabaseEnvStatus();

  // 1. Trường hợp chưa cấu hình credentials
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-5">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            <span>Hồ sơ & Mục tiêu cá nhân</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chỉ yêu cầu thông tin cần thiết; không yêu cầu bệnh án y tế
          </p>
        </div>

        <ProfileEditForm
          initialProfile={{
            display_name: 'Người dùng demo',
            experience_level: 'beginner',
            available_equipment: [],
            schedule_availability: [],
          }}
          isConfigured={false}
        />

        <GoalsManager initialGoals={[]} isConfigured={false} />
        <ObservationsManager initialObservations={[]} isConfigured={false} />
      </div>
    );
  }

  // 2. Kiểm tra phiên đăng nhập
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  // 3. Tải hồ sơ người dùng
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const userDisplayName =
    profileData?.display_name ||
    user.user_metadata?.display_name ||
    'Người dùng mới';

  const userExperienceLevel =
    (profileData?.experience_level as ExperienceLevel) ||
    (user.user_metadata?.experience_level as ExperienceLevel) ||
    'beginner';

  // Không tự ý điền ['Sàn nhà'] khi danh sách trống
  const userEquipment = Array.isArray(profileData?.available_equipment)
    ? (profileData.available_equipment as string[])
    : [];

  const userSchedule = (Array.isArray(profileData?.schedule_availability)
    ? profileData.schedule_availability
    : []) as unknown as ProfileScheduleDay[];

  // 4. Tải danh sách mục tiêu
  const { data: goalsData, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // 5. Tải danh sách quan sát tự khai
  const { data: observationsData, error: observationsError } = await supabase
    .from('observations')
    .select('*')
    .eq('user_id', user.id)
    .order('observed_at', { ascending: false });

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <span>Hồ sơ & Mục tiêu cá nhân</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Chỉ yêu cầu thông tin cần thiết; không yêu cầu bệnh án y tế
        </p>
      </div>

      {/* Form sửa hồ sơ */}
      <ProfileEditForm
        initialProfile={{
          display_name: userDisplayName,
          experience_level: userExperienceLevel,
          available_equipment: userEquipment,
          schedule_availability: userSchedule,
        }}
        isConfigured={true}
        fetchError={
          profileError
            ? 'Không tải được thông tin hồ sơ. Đã tạm khóa form để tránh ghi đè dữ liệu; vui lòng tải lại trang.'
            : null
        }
      />

      {/* Quản lý mục tiêu */}
      <div id="goals">
        <GoalsManager
          initialGoals={(goalsData as GoalEntity[]) || []}
          isConfigured={true}
          fetchError={goalsError ? 'Không tải được mục tiêu, thử lại sau.' : null}
        />
      </div>

      {/* Quản lý chỉ số tự khai */}
      <div id="observations">
        <ObservationsManager
          initialObservations={(observationsData as ObservationEntity[]) || []}
          isConfigured={true}
          fetchError={observationsError ? 'Không tải được chỉ số thể chất, thử lại sau.' : null}
        />
      </div>
    </div>
  );
}
