import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { HealthManager } from '@/components/health/HealthManager';
import {
  HealthProfileEntity,
  DailyCheckinEntity,
  BloodPressureEntity,
  HealthConditionEntity,
  MedicationEntity,
  AllergyEntity,
  HealthEventEntity,
  ActivityEntity,
} from '@/contracts';
import { getLocalDateString, DEFAULT_APP_TIMEZONE } from '@/lib/date-utils';

export const metadata = {
  title: 'Hồ Sơ Sức Khỏe V2 | CalisCoaching',
  description: 'Quản lý sức khỏe cá nhân toàn diện, huyết áp, sinh hoạt và an toàn rèn luyện',
};

export default async function HealthPage() {
  const envStatus = getSupabaseEnvStatus();

  // 1. Trường hợp chưa cấu hình DB
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <HealthManager
          healthProfile={null}
          todayCheckin={null}
          todayDateStr={new Date().toISOString().slice(0, 10)}
          recentCheckins={[]}
          bloodPressures={[]}
          conditions={[]}
          medications={[]}
          allergies={[]}
          events={[]}
          recentActivities={[]}
          displayName="Người dùng demo"
          isConfigured={false}
        />
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

  // 3. Tải song song tất cả các khối dữ liệu sức khỏe V2
  const [
    profileRes,
    healthProfileRes,
    checkinsRes,
    bpRes,
    conditionsRes,
    medsRes,
    allergiesRes,
    eventsRes,
    activitiesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('health_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .order('local_date', { ascending: false })
      .limit(14),
    supabase
      .from('blood_pressure_readings')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(10),
    supabase
      .from('health_conditions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('medications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('allergies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('health_events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: false })
      .limit(10),
    supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('start_at', { ascending: false })
      .limit(10),
  ]);

  const userTimezone = healthProfileRes.data?.timezone || DEFAULT_APP_TIMEZONE;
  const todayDateStr = getLocalDateString(new Date(), userTimezone);

  const queryErrors = [
    profileRes.error ? `Lỗi tải hồ sơ: ${profileRes.error.message}` : null,
    healthProfileRes.error ? `Lỗi tải hồ sơ sức khỏe: ${healthProfileRes.error.message}` : null,
    checkinsRes.error ? `Lỗi tải sinh hoạt: ${checkinsRes.error.message}` : null,
    bpRes.error ? `Lỗi tải huyết áp: ${bpRes.error.message}` : null,
    conditionsRes.error ? `Lỗi tải tình trạng: ${conditionsRes.error.message}` : null,
    medsRes.error ? `Lỗi tải thuốc: ${medsRes.error.message}` : null,
    allergiesRes.error ? `Lỗi tải dị ứng: ${allergiesRes.error.message}` : null,
    eventsRes.error ? `Lỗi tải sự kiện: ${eventsRes.error.message}` : null,
    activitiesRes.error ? `Lỗi tải hoạt động: ${activitiesRes.error.message}` : null,
  ].filter(Boolean) as string[];

  const displayName = profileRes.data?.display_name || user.user_metadata?.display_name || 'Người dùng';
  const healthProfile = (healthProfileRes.data as HealthProfileEntity) || null;
  const recentCheckins = (checkinsRes.data as DailyCheckinEntity[]) || [];
  const todayCheckin = recentCheckins.find((c) => c.local_date === todayDateStr) || null;
  const bloodPressures = (bpRes.data as BloodPressureEntity[]) || [];
  const conditions = (conditionsRes.data as HealthConditionEntity[]) || [];
  const medications = (medsRes.data as MedicationEntity[]) || [];
  const allergies = (allergiesRes.data as AllergyEntity[]) || [];
  const events = (eventsRes.data as HealthEventEntity[]) || [];
  const recentActivities = (activitiesRes.data as ActivityEntity[]) || [];

  return (
    <div className="p-4">
      <HealthManager
        healthProfile={healthProfile}
        todayCheckin={todayCheckin}
        todayDateStr={todayDateStr}
        recentCheckins={recentCheckins}
        bloodPressures={bloodPressures}
        conditions={conditions}
        medications={medications}
        allergies={allergies}
        events={events}
        recentActivities={recentActivities}
        displayName={displayName}
        isConfigured={true}
        errors={queryErrors}
      />
    </div>
  );
}
