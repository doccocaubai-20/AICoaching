import React from 'react';
import { PlayCircle, Clock, CheckCircle2 } from 'lucide-react';
import { SessionEntity } from '@/contracts';
import { parseExercises } from './program-utils';

interface SessionCardProps {
  session: SessionEntity;
  onRecordResult: (session: SessionEntity) => void;
  isConfigured: boolean;
}

export function SessionCard({ session, onRecordResult, isConfigured }: SessionCardProps) {
  const exercises = parseExercises(session.exercises);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Buổi {session.sequence_order}
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {session.title}
          </h3>
        </div>
        <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
          {exercises.length} động tác
        </span>
      </div>

      {/* Danh sách động tác trong buổi tập */}
      <div className="space-y-2">
        {exercises.map((ex, idx) => (
          <div
            key={idx}
            className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs"
          >
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                {idx + 1}. {ex.name}
              </span>
              {ex.note && (
                <span className="text-[10px] text-slate-400 block">{ex.note}</span>
              )}
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="font-medium text-slate-600 dark:text-slate-300 block">
                {ex.sets} hiệp × {ex.target_reps}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Nghỉ ~{ex.rest_seconds}s
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Nút bắt đầu ghi kết quả */}
      <button
        type="button"
        disabled={!isConfigured}
        onClick={() => onRecordResult(session)}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
      >
        <PlayCircle className="w-4 h-4" />
        <span>Ghi nhận kết quả buổi tập</span>
      </button>
    </div>
  );
}
