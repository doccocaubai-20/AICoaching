'use client';

import React, { useTransition } from 'react';
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { ReviewSuggestionEntity } from '@/contracts';
import {
  updateReviewSuggestionStatusAction,
  evaluateAndSaveReviewSuggestionAction,
  ActionResult,
} from '@/app/programs/actions';
import { REVIEW_RULE_VERSION } from './review-utils';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface ReviewSuggestionsSectionProps {
  suggestions: ReviewSuggestionEntity[];
  isConfigured: boolean;
  fetchError?: string | null;
}

export function ReviewSuggestionsSection({
  suggestions,
  isConfigured,
  fetchError,
}: ReviewSuggestionsSectionProps) {
  const [isPending, startTransition] = useTransition();

  const handleUpdateStatus = (
    suggestionId: string,
    newStatus: 'acknowledged' | 'dismissed'
  ) => {
    startTransition(async () => {
      const res = await updateReviewSuggestionStatusAction(suggestionId, newStatus);
      if (!res.success) {
        alert(res.message || 'Lỗi khi cập nhật trạng thái gợi ý.');
      }
    });
  };

  const handleEvaluate = () => {
    startTransition(async () => {
      const res = await evaluateAndSaveReviewSuggestionAction();
      if (res.message) {
        alert(res.message);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Quy tắc xem lại lịch (Review Suggestions)
            </h3>
            <span className="text-[10px] text-slate-500 block">
              Phiên bản quy tắc: <code className="text-emerald-600 font-semibold">{REVIEW_RULE_VERSION}</code>
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!isConfigured || isPending}
          onClick={handleEvaluate}
          className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          <span>Kiểm tra lịch ngay</span>
        </button>
      </div>

      {/* CẢNH BÁO NGUYÊN TẮC AN TOÀN DEMO */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Quy tắc demo tĩnh, chưa qua rà soát chuyên môn</span>
        </div>
        <p className="leading-relaxed">
          Gợi ý chỉ hỗ trợ rà soát các hoạt động diễn ra sát nhau (như Cầu lông và Calisthenics cách nhau dưới 12 giờ). 
          <strong> Tuyệt đối không tự ý thay đổi tải tập</strong> và <strong>không đưa ra kết luận y khoa về khả năng hồi phục</strong>.
        </p>
      </div>

      {fetchError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200">
          {fetchError}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-1">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Chưa có cảnh báo lịch nào cần xem xét
          </p>
          <p className="text-[11px] text-slate-400">
            Hệ thống sẽ gợi ý khi phát hiện hoạt động thực tế diễn ra sát nhau theo quy tắc demo.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {suggestions.map((sugg) => {
            const isOutdated = sugg.status === 'outdated';
            const isDismissed = sugg.status === 'dismissed';
            const isAcknowledged = sugg.status === 'acknowledged';

            return (
              <div
                key={sugg.id}
                className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                  isOutdated
                    ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-70'
                    : isDismissed
                    ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* Trạng thái gợi ý */}
                    {isOutdated ? (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded-full">
                        Dữ liệu nguồn đã thay đổi (Cũ)
                      </span>
                    ) : isDismissed ? (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-medium px-2 py-0.5 rounded-full">
                        Đã bỏ qua
                      </span>
                    ) : isAcknowledged ? (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full">
                        Đã ghi nhận
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full animate-pulse">
                        Cần xem xét
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400">
                      {formatDateVN(sugg.created_at, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Nút thao tác khi gợi ý còn hiệu lực (chưa outdated và chưa dismissed) */}
                  {!isOutdated && !isDismissed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isAcknowledged && (
                        <button
                          type="button"
                          disabled={!isConfigured || isPending}
                          onClick={() => handleUpdateStatus(sugg.id, 'acknowledged')}
                          className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
                        >
                          Đã xem
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!isConfigured || isPending}
                        onClick={() => handleUpdateStatus(sugg.id, 'dismissed')}
                        className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition"
                      >
                        Bỏ qua
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {sugg.reason}
                </p>

                {isOutdated && (
                  <p className="text-[10px] text-slate-500 italic">
                    Ghi chú: Hoạt động liên quan đã được chỉnh sửa hoặc xóa trong nhật ký nên gợi ý này không còn hiệu lực.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
