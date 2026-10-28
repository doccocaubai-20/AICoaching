'use client';

import React from 'react';
import Link from 'next/link';
import { Share2, FileText, ArrowRight } from 'lucide-react';

interface BriefCreationCTAProps {
  className?: string;
  variant?: 'banner' | 'button' | 'compact';
}

export function BriefCreationCTA({ className = '', variant = 'banner' }: BriefCreationCTAProps) {
  if (variant === 'button') {
    return (
      <Link
        href="/briefs/new"
        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-sm transition-all ${className}`}
      >
        <Share2 className="w-4 h-4 text-blue-200" />
        <span>Tạo bản tóm tắt hồ sơ</span>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href="/briefs"
        className={`flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl hover:border-blue-400 transition-all ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Hồ sơ đem đi trao đổi</div>
            <div className="text-[11px] text-slate-500">Tóm tắt có nguồn gửi HLV hoặc chuẩn bị đi khám</div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </Link>
    );
  }

  return (
    <div
      className={`p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl mt-0.5">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Hồ sơ đem đi trao đổi</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md">
                D2
              </span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Tạo bản tóm tắt có nguồn xác thực để trao đổi với HLV hoặc chuẩn bị đi khám. Hỗ trợ chia sẻ có thời hạn và thu hồi tức thì.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link
            href="/briefs"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Danh sách</span>
          </Link>
          <Link
            href="/briefs/new"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Tạo mới</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
