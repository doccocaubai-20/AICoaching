import React from 'react';
import Link from 'next/link';
import { CalendarCheck2, ArrowRight, Clock, Plus, AlertCircle } from 'lucide-react';
import { ActivityEntity, ActivityType } from '@/contracts';
import { formatDateVN } from './date-utils';

interface DashboardActivitiesSectionProps {
  activities: ActivityEntity[];
  activitiesError?: string | null;
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  calisthenics: 'Calisthenics',
  running: 'Chạy bộ',
  badminton: 'Cầu lông',
  walking: 'Đi bộ',
  other: 'Môn khác',
};

export function DashboardActivitiesSection({
  activities,
  activitiesError,
}: DashboardActivitiesSectionProps) {
  const displayActivities = activities.slice(0, 5);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
          <span>Hoạt động gần đây</span>
          {!activitiesError && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
              {activities.length}
            </span>
          )}
        </div>
        <Link
          href="/activities"
          className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-0.5"
        >
          <span>Xem tất cả</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {activitiesError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{activitiesError}</span>
        </div>
      ) : displayActivities.length === 0 ? (
        <div className="p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1.5">
          <CalendarCheck2 className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Chưa có hoạt động nào được ghi nhận</p>
          <Link
            href="/activities"
            className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Ghi hoạt động đầu tiên</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayActivities.map((act) => (
            <div
              key={act.id}
              className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {ACTIVITY_TYPE_LABELS[act.activity_type] || act.activity_type}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                      act.is_planned
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {act.is_planned ? 'Lịch dự kiến' : 'Đã tập'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>{formatDateVN(act.start_at)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{act.duration_minutes} phút</span>
                  </span>
                  {act.fatigue_level !== null && (
                    <>
                      <span>•</span>
                      <span>Mệt: {act.fatigue_level}/10</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
