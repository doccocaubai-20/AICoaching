'use client';

import React from 'react';
import Link from 'next/link';
import { Users, CheckCircle2, ChevronRight, Target, Clock } from 'lucide-react';
import { GroupWeekSummaryExport, getGroupDeepLink } from '@/contracts/group.contract';

interface GroupWeekSummaryCardProps {
  summary: GroupWeekSummaryExport;
}

/**
 * Component tóm tắt cam kết nhóm tuần theo hợp đồng CONTRACTS (Agent D export).
 * Dùng để điều phối cắm vào Dashboard, tab nhóm hoặc các màn tổng hợp.
 * Tuyệt đối không chứa hồ sơ y tế, chỉ số sức khỏe hay nhật ký cá nhân.
 */
export function GroupWeekSummaryCard({ summary }: GroupWeekSummaryCardProps) {
  const percent =
    summary.total_commitments > 0
      ? Math.round((summary.completed_commitments / summary.total_commitments) * 100)
      : 0;

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {summary.group_name}
            </h3>
            <span className="text-[11px] text-slate-500 font-normal">
              {summary.member_count}/5 thành viên • Tuần {summary.week_start}
            </span>
          </div>
        </div>

        <Link
          href={getGroupDeepLink(summary.group_id, 'commitments')}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
        >
          <span>Xem nhóm</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Tiến độ cam kết tuần */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Tiến độ chung cả nhóm:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {summary.completed_commitments}/{summary.total_commitments} hoàn thành ({percent}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Ranh giới an toàn: Chỉ cam kết chủ động công bố */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Dữ liệu cam kết độc lập</span>
        <span>Không bảng xếp hạng</span>
      </div>
    </div>
  );
}
