import React from 'react';
import { CalendarCheck2, Clock, Flame, AlertCircle } from 'lucide-react';
import { ActivityEntity } from '@/contracts';
import { computeWeeklyStats } from './stats-utils';

interface DashboardStatsSectionProps {
  activities: ActivityEntity[];
  isConfigured?: boolean;
  statsError?: string | null;
}

export function DashboardStatsSection({
  activities,
  isConfigured = true,
  statsError,
}: DashboardStatsSectionProps) {
  // Sử dụng hàm thuần computeWeeklyStats
  const stats = isConfigured && !statsError ? computeWeeklyStats(activities) : null;

  return (
    <div className="space-y-2">
      {statsError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{statsError}</span>
        </div>
      )}

      <section className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs text-center">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-1">
            <CalendarCheck2 className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 block">
            {stats !== null ? stats.totalSessions : '—'}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight">
            {!isConfigured ? 'Chưa có dữ liệu' : 'Buổi 7 ngày qua'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs text-center">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 block">
            {stats !== null ? stats.totalMinutes : '—'}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight">
            {!isConfigured ? 'Chưa có dữ liệu' : 'Phút vận động'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs text-center">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-1">
            <Flame className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 block">
            {stats !== null ? stats.distinctTypes : '—'}
          </span>
          <span className="text-[10px] text-slate-500 block leading-tight">
            {!isConfigured ? 'Chưa có dữ liệu' : 'Môn đã tập'}
          </span>
        </div>
      </section>
    </div>
  );
}
