import React from 'react';
import { Loader2 } from 'lucide-react';

// Hiện ngay khi chuyển trang, trong lúc trang mới đang tải dữ liệu từ Supabase.
// Header và thanh điều hướng dưới (trong layout) vẫn giữ nguyên.
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-slate-500 dark:text-slate-400"
    >
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
      <span className="text-xs font-medium">Đang tải dữ liệu...</span>
    </div>
  );
}
