import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Video, FileCheck, Lock, Trash2 } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getComparisonVideoSignedUrlAction, deleteComparisonVideoAction } from '@/features/media/server/media-actions';
import { deleteJourneyAttemptAction, type SkillsSupabaseClient } from '@/features/skills/server/skills-actions';

export const dynamic = 'force-dynamic';

interface AttemptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AttemptDetailPage({ params }: AttemptDetailPageProps) {
  const { id } = await params;

  let user;
  try {
    const authRes = await requireAuthenticatedUser();
    user = authRes.user;
  } catch {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
        <Lock className="w-8 h-8 text-emerald-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Yêu cầu Đăng nhập
        </h2>
        <p className="text-xs text-slate-500">
          Vui lòng đăng nhập để xem chi tiết lần thử này.
        </p>
        <Link
          href={`/login?next=/journey/attempts/${id}`}
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  const supabase = (await createServerSupabaseClient()) as unknown as SkillsSupabaseClient;
  if (!supabase) {
    return <div className="p-6 text-center text-xs text-red-500">Chưa cấu hình Supabase.</div>;
  }

  // 1. Tải thông tin lần thử (kiểm tra ownership: user_id = user.id)
  const { data: attempt, error: attemptErr } = await supabase
    .from('journey_attempts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (attemptErr || !attempt) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Không tìm thấy lần thử
        </h3>
        <p className="text-xs text-slate-500">
          Lần thử không tồn tại hoặc bạn không có quyền truy cập.
        </p>
        <Link href="/journey" className="text-xs text-emerald-600 hover:underline">
          Quay lại Hành trình
        </Link>
      </div>
    );
  }

  // 2. Lấy video nếu có đính kèm
  let signedVideoUrl: string | null = null;
  let videoRecord = null;
  let videoError: string | null = null;

  if (attempt.video_id) {
    const { data: vRec } = await supabase
      .from('journey_videos')
      .select('*')
      .eq('id', attempt.video_id)
      .eq('user_id', user.id)
      .maybeSingle();

    videoRecord = vRec;

    if (vRec && vRec.status === 'ready') {
      const signedRes = await getComparisonVideoSignedUrlAction(vRec.id);
      if (signedRes.success && signedRes.data) {
        signedVideoUrl = signedRes.data.signedUrl;
      } else {
        videoError = signedRes.message || 'Không thể tạo liên kết phát video.';
      }
    } else if (vRec && (vRec.status === 'pending_deletion' || vRec.status === 'deleted')) {
      videoError = 'Video đã bị hủy hoặc đang chờ xóa.';
    }
  }

  return (
    <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/journey"
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại Hành trình kỹ năng
          </Link>
        </div>

        {/* Card Chi tiết Lần thử */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {attempt.status === 'self_reported_achieved' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tự ghi nhận đạt
                  </span>
                ) : attempt.status === 'needs_review' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Cần xem lại nguồn
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                    <Clock className="w-3.5 h-3.5 text-blue-600" /> Đã thử (Chưa đạt)
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Lần thử bài tập: {attempt.exercise_id} ({attempt.variant_id})
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Thời điểm: {new Date(attempt.attempted_at).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Chỉ số */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Số lần (reps):</span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                {attempt.actual_reps !== null ? `${attempt.actual_reps} lần` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Thời lượng:</span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                {attempt.actual_duration_seconds !== null ? `${attempt.actual_duration_seconds} giây` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mức hỗ trợ:</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {attempt.assistance || 'bodyweight'}
              </span>
            </div>
          </div>

          {/* Ghi chú */}
          {attempt.notes && (
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú cá nhân:</span>
              <p className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-slate-600 dark:text-slate-300 italic">
                &quot;{attempt.notes}&quot;
              </p>
            </div>
          )}

          {/* Nguồn liên kết */}
          {attempt.source_ref && (
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs space-y-1">
              <span className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                Chứng cứ nền liên kết:
              </span>
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                Loại: <strong>{(attempt.source_ref as any).sourceType || (attempt.source_ref as any).type}</strong> • ID: {(attempt.source_ref as any).sourceId || (attempt.source_ref as any).id}
              </p>
              {attempt.source_invalidated_at && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 pt-0.5">
                  ⚠️ {attempt.source_invalidation_reason || 'Nguồn đã thay đổi'}
                </p>
              )}
            </div>
          )}

          {/* Clip đối chiếu */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-600" />
              Clip Đối Chiếu Đính Kèm
            </h3>

            {signedVideoUrl ? (
              <div className="space-y-2">
                <div className="aspect-video bg-black rounded-xl overflow-hidden max-w-lg mx-auto">
                  <video
                    src={signedVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  * Tệp video lưu trữ riêng tư. Liên kết có hiệu lực 5 phút (TTL 300s).
                </p>
              </div>
            ) : videoError ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-center space-y-2">
                <p className="text-amber-600 dark:text-amber-400 font-medium">{videoError}</p>
                <p className="text-[11px] text-slate-400">
                  Lỗi phát hoặc tệp bị thiếu không làm mất kết quả lần thử của bạn.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 text-center">
                Lần thử này không đính kèm clip đối chiếu. Video là tùy chọn và không bắt buộc để ghi nhận tiến trình.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
