'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Target,
  Calendar,
  Settings,
  Clock,
  ShieldCheck,
  BellOff,
  UserPlus,
} from 'lucide-react';
import {
  GroupEntity,
  GroupMemberEntity,
  GroupCommitmentEntity,
  GroupMeetupEntity,
  GroupRole,
} from '@/contracts/group.contract';
import { getRoleBadgeStyle } from './group-utils';
import { WeeklyCommitmentsSection } from './WeeklyCommitmentsSection';
import { GroupMeetupsSection } from './GroupMeetupsSection';
import { GroupMembersSection } from './GroupMembersSection';
import { InviteMemberModal } from './InviteMemberModal';
import { CommitmentFormModal } from './CommitmentFormModal';

interface GroupDetailManagerProps {
  group: GroupEntity;
  workoutDraft?: {runId:string;title:string;content:string;notes:string} | null;
  currentUserId: string;
  members: GroupMemberEntity[];
  userRole?: GroupRole;
  isMuted?: boolean;
  initialWeekStart: string;
  commitments: GroupCommitmentEntity[];
  meetups: GroupMeetupEntity[];
}

export function GroupDetailManager({
  group, workoutDraft,
  currentUserId,
  members,
  userRole,
  isMuted = false,
  initialWeekStart,
  commitments,
  meetups,
}: GroupDetailManagerProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'commitments' | 'meetups' | 'members' | null;

  const [activeTab, setActiveTab] = useState<'commitments' | 'meetups' | 'members'>(
    initialTab && ['commitments', 'meetups', 'members'].includes(initialTab)
      ? initialTab
      : 'commitments'
  );

  const [draftOpen,setDraftOpen]=useState(Boolean(workoutDraft));
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const roleStyle = userRole ? getRoleBadgeStyle(userRole) : null;
  const canInvite =
    (userRole === 'owner' || userRole === 'admin') && members.length < 5 && group.status === 'active';

  return (
    <div className="space-y-4">
      {workoutDraft && <CommitmentFormModal isOpen={draftOpen} onClose={()=>setDraftOpen(false)} groupId={group.id} weekStart={initialWeekStart}
        existingCommitment={commitments.find(c=>c.user_id===currentUserId && c.week_start===initialWeekStart)} initialDraft={workoutDraft} />}
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách nhóm</span>
        </Link>

        {canInvite && (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Mời bạn bè</span>
          </button>
        )}
      </div>

      {/* Group Header Card */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {group.name}
              </h1>
              {roleStyle && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleStyle.className}`}>
                  {roleStyle.label}
                </span>
              )}
              {isMuted && (
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="Đã tắt thông báo">
                  <BellOff className="w-3 h-3" />
                  <span>Đã tắt thông báo</span>
                </span>
              )}
              {group.status === 'archived' && (
                <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                  Đã lưu trữ
                </span>
              )}
            </div>

            {group.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {group.description}
              </p>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{members.length}/5 thành viên</span>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Múi giờ: {group.timezone}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('commitments')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'commitments'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Cam kết tuần</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('meetups')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'meetups'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Lịch hẹn ({meetups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'members'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Thành viên ({members.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'commitments' && (
        <WeeklyCommitmentsSection
          group={group}
          currentUserId={currentUserId}
          members={members}
          initialWeekStart={initialWeekStart}
          commitments={commitments}
        />
      )}

      {activeTab === 'meetups' && (
        <GroupMeetupsSection
          groupId={group.id}
          currentUserId={currentUserId}
          meetups={meetups}
        />
      )}

      {activeTab === 'members' && (
        <GroupMembersSection
          group={group}
          currentUserId={currentUserId}
          members={members}
          userRole={userRole}
          isMuted={isMuted}
        />
      )}

      {/* Modal Mời Thành Viên */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />
    </div>
  );
}
