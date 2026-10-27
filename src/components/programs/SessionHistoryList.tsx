import React from 'react';
import { CalendarCheck2, Clock, Flame, FileText, CheckCircle2 } from 'lucide-react';
import { SessionResultEntity, SessionEntity } from '@/contracts';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface SessionHistoryListProps {
  results: SessionResultEntity[];
  sessions: SessionEntity[];
  fetchError?: string | null;
}

export function SessionHistoryList({
  results,
  sessions,
  fetchError,
}: SessionHistoryListProps) {
  // Bản đồ tra cứu tên buổi tập theo session_id
  const sessionMap = new Map<string, string>();
  for (const s of sessions) {
    sessionMap.set(s.id, s.title);
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Lịch sử kết quả buổi tập tự khai
          </h3>
        </div>
        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
          {results.length} lượt
        </span>
      </div>

      {fetchError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200">
          {fetchError}
        </div>
      ) : results.length === 0 ? (
        <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1.5">
          <CalendarCheck2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Chưa có kết quả buổi tập nào được ghi nhận
          </p>
          <p className="text-[11px] text-slate-400">
            Hãy chọn một buổi tập mẫu ở trên và bấm "Ghi nhận kết quả buổi tập" để cập nhật vào hồ sơ.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((item) => {
            const sessionTitle =
              sessionMap.get(item.session_id) || 'Buổi tập Calisthenics';
            const data = (item.self_reported_data || {}) as Record<string, any>;
            const completedExercises: Array<{
              exercise_name: string;
              actual_sets: number;
              actual_reps: string;
            }> = Array.isArray(data.completed_exercises) ? data.completed_exercises : [];
            const perceived = data.perceived_exertion_1_10;

            return (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      {sessionTitle}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {formatDateVN(item.completed_at, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 shrink-0">
                    Minh họa Demo
                  </span>
                </div>

                {/* Các động tác đã hoàn thành */}
                {completedExercises.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Động tác đã tự khai ({completedExercises.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {completedExercises.map((ex, exIdx) => (
                        <div
                          key={exIdx}
                          className="flex items-center justify-between text-[11px] bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700/60"
                        >
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                            {ex.exercise_name}
                          </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                            {ex.actual_sets} hiệp × {ex.actual_reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mức gắng sức & Ghi chú */}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                  {perceived !== null && perceived !== undefined && (
                    <div className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>
                        Mức gắng sức: <strong>{perceived}</strong>/10
                      </span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="flex items-center gap-1 max-w-xs truncate">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
