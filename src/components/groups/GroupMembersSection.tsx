'use client';

import React, { useState, useTransition } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  Bell,
  BellOff,
  LogOut,
  Archive,
  Crown,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  GroupEntity,
  GroupMemberEntity,
  GroupRole,
} from '@/contracts/group.contract';
import { getRoleBadgeStyle, formatDateTimeVN } from './group-utils';
import { toggleGroupMuteAction } from '@/app/groups/actions';
import { InviteMemberModal } from './InviteMemberModal';
import { TransferOrArchiveModal } from './TransferOrArchiveModal';

interface GroupMembersSectionProps {
  group: GroupEntity;
  currentUserId: string;
  members: GroupMemberEntity[];
  userRole?: GroupRole;
  isMuted?: boolean;
}

export function GroupMembersSection({
  group,
  currentUserId,
  members,
  userRole,
  isMuted = false,
}: GroupMembersSectionProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLeaveOrArchiveOpen, setIsLeaveOrArchiveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isOwner = userRole === 'owner';
  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin';
  const canInvite = isAdminOrOwner && members.length < 5 && group.status === 'active';

  const otherActiveMembers = members.filter((m) => m.user_id !== currentUserId && m.status === 'active');

  const handleToggleMute = () => {
    startTransition(async () => {
      await toggleGroupMuteAction(group.id, !isMuted);
    });
  };

  return (
    <div className="space-y-4">
      {/* Sức chứa và nút mời */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Thành viên ({members.length}/5)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Nhóm tối thiểu 1 và tối đa 5 người quen cùng giữ kỷ luật.
          </p>
        </div>

        {canInvite && (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Mời thêm</span>
          </button>
        )}
      </div>

      {/* Danh sách thành viên */}
      <div className="space-y-2">
        {members.map((member) => {
          const isMe = member.user_id === currentUserId;
          const roleStyle = getRoleBadgeStyle(member.role);

          return (
            <div
              key={member.id}
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    member.role === 'owner'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : member.role === 'admin'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {member.role === 'owner' ? <Crown className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {member.display_name || 'Thành viên'}
                    </span>
                    {isMe && <span className="text-[10px] text-emerald-600 font-normal">(Bạn)</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Tham gia: {formatDateTimeVN(member.joined_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleStyle.className}`}>
                  {roleStyle.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cài đặt cá nhân trong nhóm: Mute & Rời nhóm */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Cài đặt nhóm của bạn
        </h4>

        <div className="flex items-center justify-between pt-1">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
              Thông báo trong app
            </span>
            <span className="text-[11px] text-slate-400 block">
              {isMuted ? 'Đang tắt badge thông báo cho nhóm này' : 'Nhận badge thông báo khi có phản hồi'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleMute}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              isMuted
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {isMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'Đã tắt' : 'Đang bật'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-rose-600 block">
              {isOwner ? 'Rời nhóm hoặc Giải tán' : 'Rời khỏi nhóm'}
            </span>
            <span className="text-[11px] text-slate-400 block">
              {isOwner
                ? 'Chủ nhóm rời phải chuyển quyền hoặc giải tán, không để nhóm vô chủ'
                : 'Dữ liệu sức khỏe & tập luyện cá nhân của bạn hoàn toàn không bị ảnh hưởng'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLeaveOrArchiveOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isOwner ? 'Quản lý rời' : 'Rời nhóm'}</span>
          </button>
        </div>
      </div>

      {/* Modal Mời Thành Viên */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />

      {/* Modal Chuyển Quyền hoặc Giải tán */}
      <TransferOrArchiveModal
        isOpen={isLeaveOrArchiveOpen}
        onClose={() => setIsLeaveOrArchiveOpen(false)}
        groupId={group.id}
        isOwner={isOwner}
        otherActiveMembers={otherActiveMembers}
      />
    </div>
  );
}
