import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ActivityManager } from '@/components/activities/ActivityManager';
import { ActivityEntity } from '@/contracts';

export default async function ActivitiesPage() {
  const envStatus = getSupabaseEnvStatus();

  // 1. Trường hợp chưa cấu hình credentials: Chế độ Standalone độc lập
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <ActivityManager
          initialActivities={[]}
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

  // 3. Tải danh sách hoạt động của người dùng qua RLS (mới nhất trước)
  const { data: activitiesData, error: activitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', user.id)
    .order('start_at', { ascending: false });

  return (
    <div className="p-4 space-y-4">
      <ActivityManager
        initialActivities={(activitiesData as ActivityEntity[]) || []}
        isConfigured={true}
        fetchError={
          activitiesError
            ? 'Không tải được nhật ký hoạt động, thử lại sau.'
            : null
        }
      />
    </div>
  );
}
