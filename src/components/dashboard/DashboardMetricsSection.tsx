import React from 'react';
import Link from 'next/link';
import { ActivitySquare, ArrowRight, AlertCircle } from 'lucide-react';
import { ObservationEntity } from '@/contracts';
import { formatDateVN, formatSourceLabel } from './date-utils';

interface DashboardMetricsSectionProps {
  observations: ObservationEntity[];
  metricsError?: string | null;
}

export function DashboardMetricsSection({
  observations,
  metricsError,
}: DashboardMetricsSectionProps) {
  const latestWeight = observations.find((o) => o.metric_type === 'weight');
  const latestHeight = observations.find((o) => o.metric_type === 'height');

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <ActivitySquare className="w-4 h-4 text-emerald-600" />
          <span>Chỉ số tự khai mới nhất</span>
        </div>
        <Link
          href="/profile#observations"
          className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-0.5"
        >
          <span>Cập nhật</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Số liệu tự khai theo ngày và nguồn. Tuyệt đối không tạo điểm sức khỏe tổng hợp, không suy luận y tế.
      </p>

      {metricsError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{metricsError}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {/* Cân nặng */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Cân nặng tự khai</span>
              {latestWeight ? (
                <div className="mt-1">
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {latestWeight.metric_value}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">{latestWeight.metric_unit}</span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Chưa có cân nặng <span className="text-[10px] text-slate-400 block font-normal">(Tùy chọn)</span>
                </div>
              )}
            </div>

            <div className="mt-2 pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-400">
              {latestWeight ? (
                <span>
                  {formatDateVN(latestWeight.observed_at)} • Nguồn: {formatSourceLabel(latestWeight.source)}
                </span>
              ) : (
                <Link href="/profile#observations" className="text-emerald-600 hover:underline">
                  + Thêm cân nặng
                </Link>
              )}
            </div>
          </div>

          {/* Chiều cao */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-medium block">Chiều cao tự khai</span>
              {latestHeight ? (
                <div className="mt-1">
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {latestHeight.metric_value}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">{latestHeight.metric_unit}</span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Chưa có chiều cao <span className="text-[10px] text-slate-400 block font-normal">(Tùy chọn)</span>
                </div>
              )}
            </div>

            <div className="mt-2 pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] text-slate-400">
              {latestHeight ? (
                <span>
                  {formatDateVN(latestHeight.observed_at)} • Nguồn: {formatSourceLabel(latestHeight.source)}
                </span>
              ) : (
                <Link href="/profile#observations" className="text-emerald-600 hover:underline">
                  + Thêm chiều cao
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
