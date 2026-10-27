'use client';

/**
 * CALISCOACHING MVP - CARD TÓM TẮT HỒ SƠ AI (AGENT E)
 * Hiển thị bản tóm tắt 7 ngày gần nhất, phân biệt rõ nhãn AI tạo vs Mẫu tổng hợp,
 * phát hiện dữ liệu mới sau bản tóm tắt, trích dẫn bản ghi tham chiếu và thừa nhận dữ liệu thiếu.
 */

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  FileText,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Info,
} from 'lucide-react';
import { AISummaryEntity } from '@/contracts';
import { generateAISummaryAction, deleteAISummaryAction } from '@/app/ai/actions';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface AISummaryCardProps {
  summary: AISummaryEntity | null;
  hasConsent: boolean;
  latestActivityAt?: string | null;
  loadError?: string | null;
}

export function AISummaryCard({ summary, hasConsent, latestActivityAt, loadError }: AISummaryCardProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isStale = Boolean(
    summary && latestActivityAt && new Date(latestActivityAt).getTime() > new Date(summary.created_at).getTime()
  );

  const handleGenerate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await generateAISummaryAction();
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể tạo bản tóm tắt');
      }
    });
  };

  const handleDelete = () => {
    if (!summary) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản tóm tắt này?')) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteAISummaryAction(summary.id);
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể xóa bản tóm tắt');
      }
    });
  };

  const isAIGenerated = summary?.status === 'ai_generated';
  const referenceIds = Array.isArray(summary?.reference_record_ids)
    ? (summary.reference_record_ids as string[])
    : [];

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <FileText className="w-4 h-4 text-purple-600" />
          <span>Tóm tắt hồ sơ rèn luyện</span>
        </div>
        {summary && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isAIGenerated
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {isAIGenerated ? 'AI tạo' : 'Mẫu tổng hợp (Không dùng AI)'}
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Tổng hợp toàn bộ quá trình tập luyện trong 7 ngày gần nhất, nêu rõ khoảng thời gian và chỉ ra
        những chỉ số còn thiếu (như cân nặng hoặc mức mệt).
      </p>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isStale && (
        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-700 dark:text-blue-300 text-[11px] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Có dữ liệu tập luyện mới sau bản tóm tắt này. Hãy bấm &ldquo;Tạo lại&rdquo; để cập nhật.</span>
        </div>
      )}

      {summary ? (
        <div className="space-y-3 pt-1">
          {/* Nội dung tóm tắt */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
            {summary.content}
          </div>

          {/* Dữ liệu thiếu ghi nhận */}
          {summary.missing_data_notes && (
            <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
              <span className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Chỉ số chưa ghi nhận:</span>
              </span>
              <p className="pl-4">{summary.missing_data_notes}</p>
            </div>
          )}

          {/* Bản ghi tham chiếu */}
          {referenceIds.length > 0 && (
            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center justify-between">
                <span>Nguồn dữ liệu tham chiếu ({referenceIds.length} bản ghi):</span>
                <Link
                  href="/activities"
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-0.5 font-medium"
                >
                  <span>Xem nhật ký</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {referenceIds.slice(0, 5).map((id) => (
                  <span
                    key={id}
                    className="font-mono text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                    title={id}
                  >
                    #{id.slice(0, 8)}
                  </span>
                ))}
                {referenceIds.length > 5 && (
                  <span className="text-[9px] text-slate-400 self-center">
                    +{referenceIds.length - 5} bản ghi khác
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer thông tin và thao tác */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Tạo lúc: {formatDateVN(summary.created_at, { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="flex items-center gap-2">
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
        </div>
      ) : (
        <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs text-slate-400">
            {loadError ? 'Không thể tải bản tóm tắt do lỗi truy vấn máy chủ.' : 'Chưa có bản tóm tắt hồ sơ nào được tạo.'}
          </p>
        </div>
      )}

      {/* Nút hành động */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending || !hasConsent}
        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : summary ? (
          <RefreshCw className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        <span>
          {!hasConsent
            ? 'Cần đồng ý chia sẻ dữ liệu trước'
            : summary
            ? 'Tạo lại tóm tắt mới'
            : 'Tạo bản tóm tắt hồ sơ'}
        </span>
      </button>
    </section>
  );
}
