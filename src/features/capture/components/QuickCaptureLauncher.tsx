'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, MessageSquarePlus, ArrowRight } from 'lucide-react';

interface QuickCaptureLauncherProps {
  className?: string;
  variant?: 'banner' | 'button' | 'compact';
}

export function QuickCaptureLauncher({ className = '', variant = 'banner' }: QuickCaptureLauncherProps) {
  if (variant === 'button') {
    return (
      <Link
        href="/capture"
        className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-xl shadow-sm transition-all ${className}`}
      >
        <Zap className="w-4 h-4 text-emerald-200" />
        <span>Ghi nhanh bằng 1 câu</span>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href="/capture"
        className={`flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:border-emerald-400 transition-all ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ghi hồ sơ bằng một câu</div>
            <div className="text-[11px] text-slate-500">Tự động phân tách buổi tập, giấc ngủ & chỉ số</div>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </Link>
    );
  }

  return (
    <div
      className={`p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl mt-0.5">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Ghi nhanh hồ sơ</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-md">
                D1
              </span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Nhập một câu tiếng Việt thay vì điền nhiều form: &ldquo;Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi&rdquo;.
            </p>
          </div>
        </div>
        <Link
          href="/capture"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Ghi ngay</span>
        </Link>
      </div>
    </div>
  );
}
