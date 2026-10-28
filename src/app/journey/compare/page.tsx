import React from 'react';
import Link from 'next/link';
import { ArrowLeft, SplitSquareVertical, AlertCircle, Video, Lock } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import {
  getComparisonVideoSignedUrlAction,
  deleteComparisonVideoAction,
} from '@/features/media/server/media-actions';
import { ComparisonVideoPlayer } from '@/features/media/components/ComparisonVideoPlayer';
import { type JourneyVideoAsset, mapToVideoAsset } from '@/features/media';
import type { SkillsSupabaseClient } from '@/features/skills/server/skills-actions';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  searchParams: Promise<{
    milestoneId?: string;
    exerciseId?: string;
    variantId?: string;
    videoAId?: string;
    videoBId?: string;
  }>;
}

export default async function JourneyComparePage({ searchParams }: ComparePageProps) {
  const { milestoneId, exerciseId, variantId, videoAId, videoBId } = await searchParams;

  let user;
  try {
    const authRes = await requireAuthenticatedUser();
    user = authRes.user;
  } catch {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
        <Lock className="w-8 h-8 text-purple-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Yêu cầu Đăng nhập
        </h2>
        <p className="text-xs text-slate-500">
          Video đối chiếu là dữ liệu riêng tư. Vui lòng đăng nhập để xem.
        </p>
        <Link
          href="/login?next=/journey/compare"
          className="inline-block px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold"
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

  // Truy vấn các lần thử có gắn video của người dùng cho bài tập này
  let query = supabase
    .from('journey_attempts')
    .select(`
      id,
      milestone_id,
      exercise_id,
      variant_id,
      attempted_at,
      actual_reps,
      actual_duration_seconds,
      notes,
      is_achieved_self_reported,
      video_id
    `)
    .eq('user_id', user.id)
    .not('video_id', 'is', null)
    .order('attempted_at', { ascending: true });

  if (exerciseId) {
    query = query.eq('exercise_id', exerciseId);
  }
  if (variantId) {
    query = query.eq('variant_id', variantId);
  }
  if (milestoneId) {
    query = query.eq('milestone_id', milestoneId);
  }

  const { data: attempts, error } = await query;

  if (error || !attempts || attempts.length < 2) {
    return (
      <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto my-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <SplitSquareVertical className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Cần ít nhất 2 Clip để Đối Chiếu Cạnh Nhau
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            Tính năng đối chiếu cho phép đặt 2 lần thực hiện cùng bài tập (hoặc cùng biến thể) ở 2 thời điểm khác nhau cạnh nhau để tự quan sát tiến bộ kỹ thuật (form).
          </p>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50 text-xs text-purple-800 dark:text-purple-300 text-left space-y-1">
            <p className="font-semibold">Hiện tại bạn có: {attempts?.length || 0} clip cho bài tập này.</p>
            <p className="text-[11px] text-purple-700 dark:text-purple-400">
              Hãy quay thêm một clip ngắn (15–30s) trong lần thử tiếp theo để kích hoạt màn đối chiếu.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/journey"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại Hành trình
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Chọn clip A (lần thử sớm hơn) và clip B (lần thử muộn hơn)
  const attemptA = attempts[0];
  const attemptB = attempts[attempts.length - 1];

  // Lấy video metadata
  const { data: videoAData } = await supabase
    .from('journey_videos')
    .select('*')
    .eq('id', attemptA.video_id!)
    .eq('user_id', user.id)
    .single();

  const { data: videoBData } = await supabase
    .from('journey_videos')
    .select('*')
    .eq('id', attemptB.video_id!)
    .eq('user_id', user.id)
    .single();

  if (!videoAData || !videoBData) {
    return (
      <div className="p-6 text-center text-xs text-red-500">
        Không thể tải thông tin tệp video.
      </div>
    );
  }

  // Cấp short-lived signed URL (TTL 300s)
  const [signedA, signedB] = await Promise.all([
    getComparisonVideoSignedUrlAction(videoAData.id),
    getComparisonVideoSignedUrlAction(videoBData.id),
  ]);

  if (!signedA.success || !signedA.data || !signedB.success || !signedB.data) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Không thể cấp quyền phát video</h3>
        <p className="text-xs text-slate-500">
          {signedA.message || signedB.message || 'Lỗi cấp URL ký tạm thời.'}
        </p>
        <Link href="/journey" className="text-xs text-purple-600 hover:underline">
          Quay lại
        </Link>
      </div>
    );
  }

  const clipAView = {
    video: mapToVideoAsset(videoAData),
    signedUrl: signedA.data.signedUrl,
    attemptTitle: `Lần thử ngày ${new Date(attemptA.attempted_at).toLocaleDateString('vi-VN')}`,
    attemptDate: new Date(attemptA.attempted_at).toLocaleString('vi-VN'),
    metricsText: `${attemptA.actual_reps ? `${attemptA.actual_reps} reps` : ''} ${attemptA.actual_duration_seconds ? `${attemptA.actual_duration_seconds}s` : ''}`.trim(),
  };

  const clipBView = {
    video: mapToVideoAsset(videoBData),
    signedUrl: signedB.data.signedUrl,
    attemptTitle: `Lần thử ngày ${new Date(attemptB.attempted_at).toLocaleDateString('vi-VN')}`,
    attemptDate: new Date(attemptB.attempted_at).toLocaleString('vi-VN'),
    metricsText: `${attemptB.actual_reps ? `${attemptB.actual_reps} reps` : ''} ${attemptB.actual_duration_seconds ? `${attemptB.actual_duration_seconds}s` : ''}`.trim(),
  };

  return (
    <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Navigation Top */}
        <div className="flex items-center justify-between">
          <Link
            href="/journey"
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại Hành trình kỹ năng
          </Link>
          <div className="text-xs text-slate-500">
            Bài tập: <strong className="text-slate-800 dark:text-slate-200">{exerciseId || attemptA.exercise_id}</strong> ({variantId || attemptA.variant_id})
          </div>
        </div>

        {/* Video Comparison Player */}
        <ComparisonVideoPlayer
          clipA={clipAView}
          clipB={clipBView}
        />
      </div>
    </main>
  );
}
