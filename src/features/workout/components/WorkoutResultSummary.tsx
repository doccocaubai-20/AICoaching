'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, Clock, Flame, Calendar, CheckCircle2, ArrowRight, BookOpen, Award, Target, AlertCircle } from 'lucide-react';
import { WorkoutRunEntity, WorkoutSetEntity } from '../contracts/workout.contract';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface WorkoutResultSummaryProps {
  run: WorkoutRunEntity;
  sets: WorkoutSetEntity[];
}

export function WorkoutResultSummary({ run, sets }: WorkoutResultSummaryProps) {
  const completedSets = sets.filter((s) => s.status === 'completed' && ((s.actual_reps ?? 0) > 0 || (s.actual_duration_seconds ?? 0) > 0));
  const skippedSets = sets.filter((s) => s.status === 'skipped');
  const totalSets = sets.length;

  const durationMin = run.duration_seconds
    ? Math.max(1, Math.round(run.duration_seconds / 60))
    : 1;

  // Nhóm các bài tập
  const grouped: Record<string, { completed: string[]; skipped: number }> = {};
  for (const s of sets) {
    if (!grouped[s.exercise_name]) {
      grouped[s.exercise_name] = { completed: [], skipped: 0 };
    }
    if (s.status === 'completed' && ((s.actual_reps ?? 0)>0 || (s.actual_duration_seconds ?? 0)>0)) {
      grouped[s.exercise_name].completed.push(s.actual_unit === 'seconds' ? `${s.actual_duration_seconds ?? 0} giây` : `${s.actual_reps ?? 0} reps`);
    } else if (s.status === 'skipped') {
      grouped[s.exercise_name].skipped += 1;
    }
  }

  const isPartial = skippedSets.length > 0;

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Banner */}
      <div className="text-center space-y-2 p-6 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/20 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-900/20">
          <Trophy className="w-8 h-8" />
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
          Buổi tập đã hoàn thành
        </span>
        <h1 className="text-xl font-bold text-white">{run.session_title}</h1>
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{formatDateVN(run.completed_at || run.updated_at)}</span>
        </p>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Thời lượng</span>
          </div>
          <div className="text-base font-bold text-white">{durationMin} phút</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Mức mệt RPE</span>
          </div>
          <div className="text-base font-bold text-white">
            {run.perceived_exertion_1_10 ? `${run.perceived_exertion_1_10}/10` : '—'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hoàn thành</span>
          </div>
          <div className="text-base font-bold text-white">
            {completedSets.length}/{totalSets} hiệp
          </div>
        </div>
      </div>

      {isPartial && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Buổi tập được ghi nhận <strong>Hoàn thành một phần</strong> (bỏ qua {skippedSets.length} hiệp). Dữ liệu hiệp bỏ qua không bị gán số 0.
          </span>
        </div>
      )}

      {/* 3. Detailed Exercises Breakdown */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-slate-200">Chi tiết các động tác thực tế</h3>
        <div className="space-y-2">
          {Object.entries(grouped).map(([name, data]) => (
            <div
              key={name}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-medium text-white">{name}</span>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  {data.completed.length > 0 ? (
                    <span>Thực tế: {data.completed.join(' - ')}</span>
                  ) : (
                    <span className="text-slate-500">Chưa hoàn thành hiệp nào</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-semibold">{data.completed.length} hiệp</span>
                {data.skipped > 0 && (
                  <div className="text-[10px] text-amber-400">({data.skipped} bỏ qua)</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {run.notes && (
          <div className="pt-2 text-xs text-slate-400 border-t border-slate-800/60">
            <strong>Ghi chú:</strong> {run.notes}
          </div>
        )}
      </div>

      {/* 4. Next Steps Navigation - TUÂN THỦ SPEC D3: CHỈ ĐỀ NGHỊ BƯỚC TIẾP THEO, KHÔNG TỰ CÔNG BỐ D */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🎯 Bước tiếp theo đề xuất</span>
        </h3>
        <p className="text-xs text-slate-400">
          Kết quả buổi tập đã được ghi nhận nhất quán vào hồ sơ. Bạn có thể:
        </p>

        <div className="space-y-2 pt-1">
          {/* F4: Mang ngữ cảnh run/result sang Nhật ký, Hành trình kỹ năng và Cam kết nhóm */}
          <Link
            href={`/activities?runId=${run.id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium">1. Xem nhật ký hoạt động cá nhân</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
          </Link>

          <Link
            href={`/journey?runId=${run.id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium">2. Gắn kết quả vào Hành Trình Kỹ Năng (Journey)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
          </Link>

          <Link
            href={`/groups?runId=${run.id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 transition group"
          >
            <div className="flex items-center gap-2.5">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium">3. Mở nháp cam kết nhóm rèn luyện (xác nhận trước khi gửi)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
          </Link>
        </div>
      </div>

      <div className="text-center pt-2">
        <Link
          href="/workout"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <span>Quay lại danh sách tập luyện</span>
        </Link>
      </div>
    </div>
  );
}
