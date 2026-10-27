import React from 'react';
import Link from 'next/link';
import { Sparkles, BotMessageSquare, ArrowRight, AlertCircle } from 'lucide-react';
import { AISummaryEntity } from '@/contracts';
import { formatDateVN } from './date-utils';

interface DashboardAISummaryCardProps {
  latestSummary: AISummaryEntity | null;
  aiError?: string | null;
}

export function DashboardAISummaryCard({ latestSummary, aiError }: DashboardAISummaryCardProps) {
  return (
    <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <span>AI Tóm tắt hồ sơ (Ảnh chụp)</span>
        </div>
        <Link
          href="/ai"
          className="text-xs text-slate-300 hover:text-white underline flex items-center gap-0.5"
        >
          <span>Trợ lý AI</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {aiError ? (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      ) : latestSummary ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                latestSummary.status === 'ai_generated'
                  ? 'bg-purple-900/80 text-purple-200 border border-purple-700/60'
                  : 'bg-amber-900/80 text-amber-200 border border-amber-700/60'
              }`}
            >
              {latestSummary.status === 'ai_generated' ? 'AI khởi tạo' : 'Mẫu tổng hợp (Không dùng AI)'}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatDateVN(latestSummary.created_at)}
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
            {latestSummary.content}
          </p>

          {latestSummary.missing_data_notes && (
            <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-lg text-[11px] text-amber-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>Dữ liệu còn thiếu: {latestSummary.missing_data_notes}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-300 leading-relaxed">
            Chưa có bản tóm tắt nào cho tuần này. Bạn có thể yêu cầu AI tóm tắt quá trình vận động kèm dữ liệu trích dẫn minh bạch.
          </p>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg transition"
          >
            <BotMessageSquare className="w-3.5 h-3.5" />
            <span>Tạo bản tóm tắt mới</span>
          </Link>
        </div>
      )}
    </section>
  );
}
