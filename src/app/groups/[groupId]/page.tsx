import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { GroupDetailManager } from '@/components/groups/GroupDetailManager';
import { getWeekStartForDate } from '@/components/groups/group-utils';
import {
  GroupEntity,
  GroupMemberEntity,
  GroupCommitmentEntity,
  GroupReactionEntity,
  GroupFeedbackMessageEntity,
  GroupMeetupEntity,
  GroupMeetupRSVPEntity,
  GroupRole,
} from '@/contracts/group.contract';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export const metadata = {
  title: 'Chi tiết nhóm cam kết | CalisCoaching',
  description: 'Theo dõi cam kết tuần, lịch hẹn và động viên bạn bè trong nhóm nhỏ.',
};

export default async function GroupDetailPage({ params }: PageProps) {
  const { groupId } = await params;
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          Chưa cấu hình Supabase credentials.
        </div>
      </div>
    );
  }

  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect(`/login?redirect=/groups/${groupId}`);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  // 1. Kiểm tra quyền thành viên active của người dùng hiện tại
  const { data: myMembership } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!myMembership) {
    // Không phải thành viên hoạt động: chuyển hướng hoặc từ chối
    redirect('/groups');
  }

  // 2. Tải thông tin nhóm và danh sách thành viên an toàn qua RPC
  const [groupRes, membersRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
    supabase.rpc('get_group_member_profiles', { p_group_id: groupId }),
  ]);

  const group = groupRes.data as GroupEntity | null;
  if (!group) {
    notFound();
  }

  const rawMembers = (membersRes.data as unknown as Array<{
    user_id: string;
    display_name: string;
    role: string;
    status: string;
    is_muted: boolean;
    joined_at: string;
  }>) || [];

  const members: GroupMemberEntity[] = rawMembers.map((m) => ({
    id: `${groupId}_${m.user_id}`,
    group_id: groupId,
    user_id: m.user_id,
    display_name: m.display_name,
    role: m.role as GroupRole,
    status: m.status as any,
    is_muted: Boolean(m.is_muted),
    joined_at: m.joined_at,
    left_at: null,
  }));

  // 3. Tính ngày Thứ Hai đầu tuần theo múi giờ nhóm
  const initialWeekStart = getWeekStartForDate(new Date(), group.timezone);

  // 4. Tải các cam kết của nhóm kèm phản hồi và tin nhắn
  const [commitmentsRes, reactionsRes, messagesRes, meetupsRes, rsvpsRes] = await Promise.all([
    supabase
      .from('group_commitments')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true }),
    supabase
      .from('group_reactions')
      .select('*'),
    supabase
      .from('group_feedback_messages')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase
      .from('group_meetups')
      .select('*')
      .eq('group_id', groupId)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('group_meetup_rsvps')
      .select('*'),
  ]);

  const rawCommitments = (commitmentsRes.data as GroupCommitmentEntity[]) || [];
  const rawReactions = (reactionsRes.data as GroupReactionEntity[]) || [];
  const rawMessages = (messagesRes.data as GroupFeedbackMessageEntity[]) || [];
  const rawMeetups = (meetupsRes.data as GroupMeetupEntity[]) || [];
  const rawRsvps = (rsvpsRes.data as GroupMeetupRSVPEntity[]) || [];

  // Ghép display_name, reactions, messages vào từng commitment
  const commitments: GroupCommitmentEntity[] = rawCommitments.map((c) => {
    const member = members.find((m) => m.user_id === c.user_id);
    const reactions = rawReactions.filter((r) => r.commitment_id === c.id);
    const feedback_messages = rawMessages
      .filter((m) => m.commitment_id === c.id)
      .map((msg) => {
        const author = members.find((m) => m.user_id === msg.user_id);
        return {
          ...msg,
          user_display_name: author?.display_name || 'Người quen',
        };
      });

    return {
      ...c,
      user_display_name: member?.display_name || 'Thành viên',
      reactions,
      feedback_messages,
    };
  });

  // Ghép RSVP và creator_display_name vào meetups
  const meetups: GroupMeetupEntity[] = rawMeetups.map((m) => {
    const creator = members.find((mem) => mem.user_id === m.created_by);
    const rsvps = rawRsvps
      .filter((r) => r.meetup_id === m.id)
      .map((rsvp) => {
        const attendee = members.find((mem) => mem.user_id === rsvp.user_id);
        return {
          ...rsvp,
          user_display_name: attendee?.display_name || 'Thành viên',
        };
      });

    return {
      ...m,
      creator_display_name: creator?.display_name || 'Thành viên',
      rsvps,
    };
  });

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24">
      <GroupDetailManager
        group={group}
        currentUserId={user.id}
        members={members}
        userRole={myMembership.role as GroupRole}
        isMuted={Boolean(myMembership.is_muted)}
        initialWeekStart={initialWeekStart}
        commitments={commitments}
        meetups={meetups}
      />
    </div>
  );
}
