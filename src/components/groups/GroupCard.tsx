'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Clock, Shield, ChevronRight, BellOff } from 'lucide-react';
import { GroupEntity, GroupRole } from '@/contracts/group.contract';
import { getRoleBadgeStyle } from './group-utils';

interface GroupCardProps {
  group: GroupEntity;
  memberCount: number;
  userRole?: GroupRole;
  isMuted?: boolean;
}

export function GroupCard({ group, memberCount, userRole, isMuted = false }: GroupCardProps) {
  const roleStyle = userRole ? getRoleBadgeStyle(userRole) : null;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition shadow-sm hover:shadow group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-base group-hover:text-emerald-600 transition">
              {group.name}
            </h3>
            {roleStyle && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleStyle.className}`}>
                {roleStyle.label}
              </span>
            )}
            {isMuted && (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="Đã tắt thông báo">
                <BellOff className="w-3 h-3" />
              </span>
            )}
            {group.status === 'archived' && (
              <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                Đã lưu trữ
              </span>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {group.description}
            </p>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition shrink-0 mt-0.5" />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{memberCount}/5 thành viên</span>
        </div>

        <div className="flex items-center gap-1 text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{group.timezone}</span>
        </div>
      </div>
    </Link>
  );
}
