import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ActivityManager } from '@/components/activities/ActivityManager';
import { ActivityEntity } from '@/contracts';

interface ActivitiesPageProps {
  searchParams?: Promise<{
    highlight?: string;
    date?: string;
    runId?: string;
  }>;
}

export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  let highlightId = resolvedParams.highlight;
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
          highlightId={highlightId}
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

  if (resolvedParams.runId && /^[0-9a-f-]{36}$/i.test(resolvedParams.runId)) {
    const {data:run}=await supabase.from('workout_runs').select('idempotency_key').eq('id',resolvedParams.runId).eq('user_id',user.id).eq('status','completed').maybeSingle();
    if(run?.idempotency_key) {
      const {data:activity}=await supabase.from('activities').select('id').eq('user_id',user.id).eq('idempotency_key',run.idempotency_key).maybeSingle();
      highlightId=activity?.id || highlightId;
    }
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
        key={highlightId || 'all'} initialActivities={(activitiesData as ActivityEntity[]) || []}
        isConfigured={true}
        highlightId={highlightId}
        fetchError={
          activitiesError
            ? 'Không tải được nhật ký hoạt động, thử lại sau.'
            : null
        }
      />
    </div>
  );
}
