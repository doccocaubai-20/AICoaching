'use client';

import React from 'react';
import Link from 'next/link';
import { Target, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { JourneySummaryDTO } from '../contracts/skills.contract';

interface JourneySummaryCardProps {
  summary: JourneySummaryDTO | null;
}

export function JourneySummaryCard({ summary }: JourneySummaryCardProps) {
  if (!summary) {
    return (
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600" />
            Hành trình kỹ năng
          </span>
          <Link
            href="/journey"
            className="text-xs text-emerald-600 hover:underline font-medium inline-flex items-center gap-1"
          >
            Khám phá <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          Chưa chọn hành trình kỹ năng nào. Bắt đầu hành trình Hít xà đơn để theo dõi tiến trình thực tế.
        </p>
      </div>
    );
  }

  const percentage = summary.totalMilestones > 0
    ? Math.round((summary.achievedCount / summary.totalMilestones) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Hành trình kỹ năng ({summary.criteriaVersion})
        </span>
        <Link
          href="/journey"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
        >
          Chi tiết <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          {summary.journeyTitle || summary.title}
        </h4>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Tiến độ tiêu chí: {summary.achievedCount} / {summary.totalMilestones} mốc</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{percentage}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Cảnh báo needs_review nếu có */}
      {summary.needsReviewCount > 0 && (
        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>Có {summary.needsReviewCount} mốc có bằng chứng cần xem xét lại do nguồn thay đổi.</span>
        </div>
      )}

      {/* Footer thông tin minh họa */}
      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        <span>* Tự nhận định, không tự cấp Verified</span>
        {summary.latestAttemptAt && (
          <span>Lần thử gần nhất: {new Date(summary.latestAttemptAt).toLocaleDateString('vi-VN')}</span>
        )}
      </div>
    </div>
  );
}
