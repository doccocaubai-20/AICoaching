import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { getWorkoutRunAction } from '@/features/workout/server/workout-actions';
import { ActiveWorkoutView } from '@/features/workout/components/ActiveWorkoutView';
import { WorkoutResultSummary } from '@/features/workout/components/WorkoutResultSummary';

export const dynamic = 'force-dynamic';

interface WorkoutRunPageProps {
  params: Promise<{
    runId: string;
  }>;
}

export default async function WorkoutRunPage({ params }: WorkoutRunPageProps) {
  const { runId } = await params;
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    redirect(`/login?next=/workout/${runId}`);
  }

  const result = await getWorkoutRunAction(runId);

  if (!result.success || !result.data) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-white">Không tìm thấy buổi tập</h1>
        <p className="text-xs text-slate-400">
          {result.message || 'Phiên tập không tồn tại hoặc bạn không có quyền truy cập.'}
        </p>
        <div className="pt-2">
          <Link
            href="/workout"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay về danh sách tập luyện</span>
          </Link>
        </div>
      </div>
    );
  }

  const { run, sets } = result.data;

  // 1. Nếu buổi tập đã hoàn thành -> hiển thị tổng kết kết quả
  if (run.status === 'completed') {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        <WorkoutResultSummary run={run} sets={sets} />
      </div>
    );
  }

  // 2. Nếu buổi tập đã bị hủy bỏ (abandoned)
  if (run.status === 'abandoned') {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <RotateCcw className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-white">Buổi tập đã bị hủy</h1>
        <p className="text-xs text-slate-400">
          Phiên tập <strong>{run.session_title}</strong> đã được đánh dấu hủy bỏ và không lưu thành tích vào hồ sơ.
        </p>
        <div className="pt-2">
          <Link
            href="/workout"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-900/30"
          >
            <span>Bắt đầu buổi tập mới</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Buổi tập đang hoạt động (in_progress hoặc paused) -> Màn hình tập trực tiếp
  return (
    <div className="px-4 py-6">
      <ActiveWorkoutView initialRun={run} initialSets={sets} />
    </div>
  );
}
