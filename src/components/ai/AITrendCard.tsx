'use client';

/**
 * CALISCOACHING MVP - CARD PHÂN TÍCH XU HƯỚNG P1 (AGENT E)
 * Nguyên tắc: Số liệu do mã TypeScript tính thuần, AI chỉ diễn giải và trích dẫn nguồn.
 * Cho phép người dùng chọn chu kỳ 4 tuần hoặc 8 tuần.
 */

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  BarChart3,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Trash2,
  Clock,
  Loader2,
  Calendar,
} from 'lucide-react';
import { AISummaryEntity } from '@/contracts';
import { analyzeProfileTrendsAction, deleteAISummaryAction } from '@/app/ai/actions';
import { formatDateVN } from '@/components/dashboard/date-utils';
import { ProfileMetrics, AITrendHighlight } from '@/lib/ai/trend-analysis';

interface AITrendCardProps {
  trendSummary: AISummaryEntity | null;
  hasConsent: boolean;
  loadError?: string | null;
}

export function AITrendCard({ trendSummary, hasConsent, loadError }: AITrendCardProps) {
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnalyze = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await analyzeProfileTrendsAction(weeks);
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể thực hiện phân tích xu hướng');
      }
    });
  };

  const handleDelete = () => {
    if (!trendSummary) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản phân tích xu hướng này?')) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteAISummaryAction(trendSummary.id);
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể xóa bản phân tích');
      }
    });
  };

  // Parse nội dung JSON đã lưu
  let parsedContent: {
    highlights?: AITrendHighlight[];
    missing_data?: string[];
    period?: { from: string; to: string; weeks: number };
  } | null = null;

  let storedMetrics: ProfileMetrics | null = null;

  if (trendSummary) {
    try {
      parsedContent = JSON.parse(trendSummary.content);
    } catch {
      parsedContent = null;
    }

    const inputScope = trendSummary.input_scope as Record<string, unknown> | null;
    if (inputScope?.metrics) {
      storedMetrics = inputScope.metrics as unknown as ProfileMetrics;
    }
  }

  const isAIGenerated = trendSummary?.status === 'ai_generated';

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <span>Phân tích xu hướng rèn luyện</span>
        </div>
        {trendSummary && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isAIGenerated
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {isAIGenerated ? 'AI diễn giải' : 'Số liệu tính tự động – Không dùng AI'}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Đánh giá độ đều đặn theo tuần, kế hoạch so với thực tế, cơ cấu môn tập và xu hướng mức mệt.
        Toàn bộ số liệu được tính bằng mã nguồn chính xác, AI chỉ hỗ trợ diễn giải.
      </p>

      {/* Bộ chọn chu kỳ */}
      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
        <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Chu kỳ phân tích:</span>
        </span>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setWeeks(4)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              weeks === 4
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            4 tuần gần nhất
          </button>
          <button
            type="button"
            onClick={() => setWeeks(8)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              weeks === 8
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            8 tuần gần nhất
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {trendSummary && parsedContent ? (
        <div className="space-y-3 pt-1">
          {/* Danh sách Highlights nổi bật */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Điểm nổi bật:
            </span>
            <div className="space-y-2">
              {(parsedContent.highlights || []).map((h, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl space-y-1.5"
                >
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {h.text}
                  </p>
                  {h.references && h.references.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-slate-400">Nguồn:</span>
                      {h.references.slice(0, 4).map((ref) => (
                        <Link
                          key={ref.id}
                          href="/activities"
                          className="font-mono text-[9px] bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 hover:underline px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 flex items-center gap-0.5"
                          title={ref.id}
                        >
                          <span>#{ref.id.slice(0, 8)}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bảng chỉ số cơ bản */}
          {storedMetrics && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Chỉ số đo lường ({storedMetrics.period?.weeks ?? weeks} tuần):</span>
              </span>

              {/* Tần suất theo tuần */}
              {storedMetrics.weekly_frequency && storedMetrics.weekly_frequency.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-medium">Tần suất theo tuần:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {storedMetrics.weekly_frequency.map((wf) => (
                      <div
                        key={wf.week_number}
                        className="p-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-[10px] flex items-center justify-between"
                      >
                        <span className="text-slate-600 dark:text-slate-400">{wf.label}:</span>
                        {wf.has_records ? (
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {wf.session_count} buổi
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Không có bản ghi</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cơ cấu thời lượng môn */}
              {storedMetrics.sport_distribution && storedMetrics.sport_distribution.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">
                    Cơ cấu thời lượng theo môn:
                  </span>
                  <div className="space-y-1">
                    {storedMetrics.sport_distribution.map((sd) => (
                      <div key={sd.sport} className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span>{sd.label}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {sd.minutes} phút ({sd.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full"
                            style={{ width: `${Math.min(sd.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dữ liệu thiếu ghi nhận */}
          {parsedContent.missing_data && parsedContent.missing_data.length > 0 && (
            <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
              <span className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Lưu ý về dữ liệu:</span>
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                {parsedContent.missing_data.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer thông tin */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Tạo lúc: {formatDateVN(trendSummary.created_at, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs text-slate-400">
            {loadError ? 'Không thể tải bản phân tích xu hướng do lỗi truy vấn máy chủ.' : 'Chưa có bản phân tích xu hướng nào.'}
          </p>
        </div>
      )}

      {/* Nút hành động */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={isPending || !hasConsent}
        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        <span>
          {!hasConsent
            ? 'Cần đồng ý chia sẻ dữ liệu trước'
            : trendSummary
            ? `Cập nhật phân tích xu hướng (${weeks} tuần)`
            : `Chạy phân tích xu hướng (${weeks} tuần)`}
        </span>
      </button>
    </section>
  );
}
