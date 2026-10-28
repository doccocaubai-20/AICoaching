'use client';

import React from 'react';
import { Award, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import type { SkillJourney } from '../contracts/skills.contract';

interface JourneyHeaderProps {
  journey: SkillJourney;
  totalMilestones: number;
  achievedCount: number;
  needsReviewCount: number;
  attemptedCount: number;
}

export function JourneyHeader({
  journey,
  totalMilestones,
  achievedCount,
  needsReviewCount,
  attemptedCount,
}: JourneyHeaderProps) {
  const percentage = totalMilestones > 0 ? Math.round((achievedCount / totalMilestones) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Disclaimer Banner: Nội dung minh họa */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold">Nội dung minh họa thử nghiệm kỹ năng ({journey.criteriaVersion})</p>
          <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            {journey.disclaimer}
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Lộ trình cốt lõi
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Nguồn: {journey.contentSource}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {journey.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {achievedCount} / {totalMilestones}
              </div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                Mốc tự đạt
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {journey.description}
        </p>

        {/* Thanh tiến độ */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Tiến độ hành trình</span>
            <span>{percentage}% hoàn thành</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Thống kê trạng thái tách bạch */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-center">
            <div className="text-xs text-slate-500">Chưa thử</div>
            <div className="text-base font-bold text-slate-700 dark:text-slate-300">
              {totalMilestones - achievedCount - needsReviewCount - attemptedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-center">
            <div className="text-xs text-blue-600 dark:text-blue-400">Đang thử</div>
            <div className="text-base font-bold text-blue-700 dark:text-blue-300">
              {attemptedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-center">
            <div className="text-xs text-emerald-600 dark:text-emerald-400">Tự ghi đạt</div>
            <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
              {achievedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-center">
            <div className="text-xs text-amber-600 dark:text-amber-400">Cần xem lại</div>
            <div className="text-base font-bold text-amber-700 dark:text-amber-300">
              {needsReviewCount}
            </div>
          </div>
        </div>

        {/* Thông tin nguyên tắc phân định */}
        <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <Info className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
          <span>
            <strong>Nguyên tắc:</strong> Mở bài học, tích lũy điểm XP và đạt mốc tiêu chí là 3 việc riêng biệt. Hệ thống không tự động cấp chứng nhận &quot;Verified&quot; chỉ dựa vào tổng số buổi tập hoặc điểm XP.
          </span>
        </div>
      </div>
    </div>
  );
}
