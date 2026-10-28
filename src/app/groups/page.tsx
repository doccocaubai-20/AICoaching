import React from 'react';
import { getOwnedWorkoutDraft } from '@/lib/server/workout-followup';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { GroupsManager } from '@/components/groups/GroupsManager';
import { GroupEntity, GroupRole } from '@/contracts/group.contract';

export const metadata = {
  title: 'Nhóm cùng giữ cam kết | CalisCoaching',
  description: 'Nhóm nhỏ 1-5 người quen cùng giữ kỷ luật, cam kết tuần và phản hồi động viên.',
};

export default async function GroupsPage({searchParams}: {searchParams?:Promise<{runId?:string}>}) {
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <GroupsManager groups={[]} />
      </div>
    );
  }

  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login?redirect=/groups');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  // Tải các nhóm mà user đang tham gia với tư cách thành viên hoạt động
  const { data: myMemberships } = await supabase
    .from('group_members')
    .select('group_id, role, is_muted')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const groupsData: Array<{
    group: GroupEntity;
    memberCount: number;
    userRole: GroupRole;
    isMuted: boolean;
  }> = [];

  if (myMemberships && myMemberships.length > 0) {
    const groupIds = myMemberships.map((m) => m.group_id);

    const [groupsRes, allMembersRes] = await Promise.all([
      supabase.from('groups').select('*').in('id', groupIds),
      supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active'),
    ]);

    const groupsList = (groupsRes.data as GroupEntity[]) || [];
    const membersList = allMembersRes.data || [];

    for (const membership of myMemberships) {
      const g = groupsList.find((item) => item.id === membership.group_id);
      if (g) {
        const count = membersList.filter((m) => m.group_id === g.id).length;
        groupsData.push({
          group: g,
          memberCount: count,
          userRole: membership.role as GroupRole,
          isMuted: Boolean(membership.is_muted),
        });
      }
    }
  }

  const {runId}=searchParams ? await searchParams : {};
  const draft=await getOwnedWorkoutDraft(runId);
  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <GroupsManager groups={groupsData} workoutDraft={draft} />
    </div>
  );
}
