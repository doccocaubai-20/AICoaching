'use client';

import React, { useState } from 'react';
import { Users, Plus, ShieldCheck, HeartHandshake, Calendar, Sparkles } from 'lucide-react';
import { GroupEntity, GroupRole } from '@/contracts/group.contract';
import { GroupCard } from './GroupCard';
import { CreateGroupModal } from './CreateGroupModal';

interface GroupItemData {
  group: GroupEntity;
  memberCount: number;
  userRole: GroupRole;
  isMuted: boolean;
}

interface GroupsManagerProps {
  groups: GroupItemData[];
}

export function GroupsManager({ groups }: GroupsManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      {/* Banner Giới thiệu D5 & Cam kết bảo mật */}
      <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <HeartHandshake className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Nhóm nhỏ cùng giữ cam kết (D5)
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              3–5 người quen • Cam kết cá nhân hàng tuần • Phản hồi động viên
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Không bảng xếp hạng cân nặng hay thành tích, không mạng xã hội công khai. Nhóm nhỏ tập trung vào sự đồng hành, giúp mỗi người tự hoàn thành cam kết tập luyện cá nhân của mình.
        </p>

        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Bảo mật tuyệt đối: Nhóm không truy cập hồ sơ y tế hay nhật ký riêng của bạn.</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Nhóm của bạn ({groups.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo nhóm mới</span>
        </button>
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bạn chưa tham gia nhóm nào
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Hãy tạo nhóm riêng từ 1 đến 5 người quen, hoặc nhờ bạn bè gửi liên kết mời gia nhập để cùng nhau giữ cam kết tập luyện.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo nhóm đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {groups.map((item) => (
            <GroupCard
              key={item.group.id}
              group={item.group}
              memberCount={item.memberCount}
              userRole={item.userRole}
              isMuted={item.isMuted}
            />
          ))}
        </div>
      )}

      {/* Modal Tạo Nhóm */}
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
