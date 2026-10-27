import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { HealthProfileContainer } from '@/components/health-v2/HealthProfileContainer';
import {
  GoalEntity,
  ObservationEntity,
  BloodPressureEntity,
  DailyCheckinEntity,
  HealthConditionEntity,
  AllergyEntity,
  MedicationEntity,
  HealthEventEntity,
  HealthDocumentEntity,
  ActivityEntity,
  HealthProfileEntity,
  ExperienceLevel,
  ProfileScheduleDay,
} from '@/contracts';

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
        <HealthProfileContainer
          userDisplayName="Người dùng demo"
          userExperienceLevel="beginner"
          userEquipment={[]}
          userSchedule={[]}
          profileError={null}
          goals={[]}
          goalsError={null}
          healthProfile={null}
          observations={[]}
          bloodPressures={[]}
          dailyCheckins={[]}
          conditions={[]}
          allergies={[]}
          medications={[]}
          healthEvents={[]}
          documents={[]}
          activities={[]}
          isConfigured={false}
        />
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

  // 3. Tải toàn bộ dữ liệu song song cho Hồ sơ sức khỏe V2
  const [
    profileRes,
    goalsRes,
    observationsRes,
    healthProfileRes,
    bpRes,
    checkinsRes,
    conditionsRes,
    allergiesRes,
    medicationsRes,
    eventsRes,
    docsRes,
    activitiesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('observations').select('*').eq('user_id', user.id).order('observed_at', { ascending: false }),
    supabase.from('health_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('blood_pressure_readings').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }),
    supabase.from('daily_checkins').select('*').eq('user_id', user.id).order('local_date', { ascending: false }).limit(30),
    supabase.from('health_conditions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('allergies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('medications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('health_events').select('*').eq('user_id', user.id).order('event_date', { ascending: false }),
    supabase.from('health_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('activities').select('*').eq('user_id', user.id).order('start_at', { ascending: false }).limit(20),
  ]);

  const userDisplayName =
    profileRes.data?.display_name ||
    user.user_metadata?.display_name ||
    'Người dùng mới';

  const userExperienceLevel =
    (profileRes.data?.experience_level as ExperienceLevel) ||
    (user.user_metadata?.experience_level as ExperienceLevel) ||
    'beginner';

  const userEquipment = Array.isArray(profileRes.data?.available_equipment)
    ? (profileRes.data.available_equipment as string[])
    : [];

  const userSchedule = (Array.isArray(profileRes.data?.schedule_availability)
    ? profileRes.data.schedule_availability
    : []) as unknown as ProfileScheduleDay[];

  return (
    <div className="p-4 sm:p-6 pb-20">
      <HealthProfileContainer
        userDisplayName={userDisplayName}
        userExperienceLevel={userExperienceLevel}
        userEquipment={userEquipment}
        userSchedule={userSchedule}
        profileError={profileRes.error ? `Không tải được hồ sơ: ${profileRes.error.message}` : null}
        goals={(goalsRes.data as GoalEntity[]) || []}
        goalsError={goalsRes.error ? `Không tải được mục tiêu: ${goalsRes.error.message}` : null}
        healthProfile={(healthProfileRes.data as HealthProfileEntity) || null}
        healthProfileError={healthProfileRes.error ? `Không tải được hồ sơ sức khỏe: ${healthProfileRes.error.message}` : null}
        observations={(observationsRes.data as ObservationEntity[]) || []}
        observationsError={observationsRes.error ? `Không tải được chỉ số thể chất: ${observationsRes.error.message}` : null}
        bloodPressures={(bpRes.data as BloodPressureEntity[]) || []}
        bloodPressuresError={bpRes.error ? `Không tải được huyết áp: ${bpRes.error.message}` : null}
        dailyCheckins={(checkinsRes.data as DailyCheckinEntity[]) || []}
        dailyCheckinsError={checkinsRes.error ? `Không tải được sinh hoạt hằng ngày: ${checkinsRes.error.message}` : null}
        conditions={(conditionsRes.data as HealthConditionEntity[]) || []}
        conditionsError={conditionsRes.error ? `Không tải được tình trạng sức khỏe: ${conditionsRes.error.message}` : null}
        allergies={(allergiesRes.data as AllergyEntity[]) || []}
        allergiesError={allergiesRes.error ? `Không tải được thông tin dị ứng: ${allergiesRes.error.message}` : null}
        medications={(medicationsRes.data as MedicationEntity[]) || []}
        medicationsError={medicationsRes.error ? `Không tải được thông tin thuốc: ${medicationsRes.error.message}` : null}
        healthEvents={(eventsRes.data as HealthEventEntity[]) || []}
        healthEventsError={eventsRes.error ? `Không tải được sự kiện y tế: ${eventsRes.error.message}` : null}
        documents={(docsRes.data as HealthDocumentEntity[]) || []}
        documentsError={docsRes.error ? `Không tải được tài liệu y tế: ${docsRes.error.message}` : null}
        activities={(activitiesRes.data as ActivityEntity[]) || []}
        activitiesError={activitiesRes.error ? `Không tải được hoạt động: ${activitiesRes.error.message}` : null}
        isConfigured={true}
      />
    </div>
  );
}
