import React from 'react';
import Link from 'next/link';
import { Target, Calendar, ArrowRight, Plus, AlertCircle } from 'lucide-react';
import { GoalEntity, GoalType } from '@/contracts';
import { formatDateVN } from './date-utils';

interface DashboardGoalsSectionProps {
  goals: GoalEntity[];
  goalsError?: string | null;
}

const GOAL_TYPE_NAMES: Record<GoalType, string> = {
  skill: 'Kỹ năng',
  endurance: 'Sức bền',
  habit: 'Thói quen',
  strength: 'Sức mạnh',
  other: 'Khác',
};

export function DashboardGoalsSection({ goals, goalsError }: DashboardGoalsSectionProps) {
  const activeGoals = goals.filter((g) => g.status === 'active');

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <Target className="w-4 h-4 text-emerald-600" />
          <span>Mục tiêu đang thực hiện</span>
          {!goalsError && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
              {activeGoals.length}
            </span>
          )}
        </div>
        <Link
          href="/profile#goals"
          className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-0.5"
        >
          <span>Quản lý</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {goalsError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{goalsError}</span>
        </div>
      ) : activeGoals.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Chưa có mục tiêu nào đang thực hiện</p>
          <Link
            href="/profile#goals"
            className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Thiết lập mục tiêu</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activeGoals.map((g) => (
            <div
              key={g.id}
              className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                    Đang diễn ra
                  </span>
                  <span className="text-[10px] bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {GOAL_TYPE_NAMES[g.goal_type] || g.goal_type}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {g.content}
                </p>
                {(g.start_date || g.end_date) && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {g.start_date ? formatDateVN(g.start_date) : 'Bắt đầu'} → {g.end_date ? formatDateVN(g.end_date) : 'Chưa định hạn'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
