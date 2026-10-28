import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Play, Calendar, Dumbbell, Sparkles, AlertCircle, ArrowRight, Clock, Award } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ResumeWorkoutCard } from '@/features/workout';
import { StartWorkoutButton } from './StartWorkoutButton';
import { WorkoutRunEntity } from '@/features/workout/contracts/workout.contract';
import { formatDateVN } from '@/components/dashboard/date-utils';

export const dynamic = 'force-dynamic';

export default async function WorkoutPage() {
  const { user, error: authError } = await getAuthenticatedUser();

  if (authError || !user) {
    redirect('/login?next=/workout');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center space-y-4">
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-amber-300 text-sm">
          Chưa cấu hình Supabase credentials. Vui lòng kiểm tra biến môi trường.
        </div>
      </div>
    );
  }

  // 1. Ưu tiên 1: Lượt tập đang dở (in_progress hoặc paused)
  const { data: activeRunRow } = await (supabase as any)
    .from('workout_runs')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['in_progress', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeRun = activeRunRow as unknown as WorkoutRunEntity | null;

  // 2. Ưu tiên 2: Buổi tiếp theo đã chọn (lịch dự kiến hoặc buổi kế tiếp trong chương trình)
  let nextPlannedSession: {
    id: string;
    title: string;
    exercisesCount: number;
    plannedDate?: string;
  } | null = null;

  if (!activeRun) {
    // Tìm lịch dự kiến gần nhất
    const { data: plannedAct } = await supabase
      .from('activities')
      .select('notes, start_at')
      .eq('user_id', user.id)
      .eq('is_planned', true)
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Tìm buổi tập mẫu từ sessions
    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('id, title, exercises, sequence_order')
      .order('sequence_order', { ascending: true })
      .limit(2);

    if (sessionRows && sessionRows.length > 0) {
      const firstSession = sessionRows[0];
      const exCount = Array.isArray(firstSession.exercises) ? firstSession.exercises.length : 3;
      nextPlannedSession = {
        id: firstSession.id,
        title: firstSession.title,
        exercisesCount: exCount,
        plannedDate: plannedAct?.start_at || undefined,
      };
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fadeIn pb-24">
      {/* 1. Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Không Gian Tập Luyện Có Trí Nhớ</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white mt-1">Buổi Tập Trực Tiếp</h1>
        <p className="text-xs text-slate-400 mt-1">
          Hệ thống bảo toàn từng hiệp tập khi tải lại trang, đóng tab và hỗ trợ ghi nhận ngoại tuyến.
        </p>
      </div>

      {/* 2. KHU VỰC ĐIỀU HƯỚNG THEO THỨ TỰ ƯU TIÊN VÀ CHỈ 1 CTA CHÍNH */}
      {/* TRƯỜNG HỢP 1: CÓ LƯỢT ĐANG DỞ */}
      {activeRun ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Phát hiện phiên tập chưa hoàn tất. Bạn cần tiếp tục hoặc hủy bỏ phiên này trước khi bắt đầu bài mới.
            </span>
          </div>

          <ResumeWorkoutCard run={activeRun} />
        </div>
      ) : nextPlannedSession ? (
        /* TRƯỜNG HỢP 2: BUỔI TIẾP THEO ĐÃ LÊN LỊCH / CHỌN */
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Buổi tập tiếp theo được gợi ý</span>
            </span>
            {nextPlannedSession.plannedDate && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDateVN(nextPlannedSession.plannedDate)}</span>
              </span>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">{nextPlannedSession.title}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                <span>{nextPlannedSession.exercisesCount} động tác chính</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Khoảng 30 - 45 phút</span>
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-400/90 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
            💡 Nội dung bài tập được cố định snapshot lúc bắt đầu; khi đang tập bạn có thể tạm dừng hoặc đóng trình duyệt mà không mất thời gian và số hiệp đã nhập.
          </div>

          {/* DUY NHẤT 1 CTA CHÍNH THEO TRẠNG THÁI */}
          <StartWorkoutButton
            sessionId={nextPlannedSession.id}
            sessionTitle={nextPlannedSession.title}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Bắt đầu buổi tập: {nextPlannedSession.title}</span>
          </StartWorkoutButton>
        </div>
      ) : (
        /* TRƯỜNG HỢP 3: CHƯA CÓ CHƯƠNG TRÌNH -> CHỌN CHƯƠNG TRÌNH */
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Dumbbell className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Chưa chọn chương trình rèn luyện</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy chọn một lộ trình bài tập phù hợp với thể trạng và dụng cụ hiện có để bắt đầu.
            </p>
          </div>

          {/* DUY NHẤT 1 CTA CHÍNH THEO TRẠNG THÁI */}
          <Link
            href="/programs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-900/30"
          >
            <span>Chọn chương trình tập</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 3. Lịch sử các phiên tập gần đây */}
      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="font-bold text-slate-300">Lộ trình liên quan</span>
          <Link href="/programs" className="text-emerald-400 hover:underline">
            Xem tất cả bài tập
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Link
            href="/programs#skill-tree"
            className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-2"
          >
            <Award className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Cây Kỹ Năng Calisthenics</span>
          </Link>

          <Link
            href="/activities"
            className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Nhật ký hoạt động</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
