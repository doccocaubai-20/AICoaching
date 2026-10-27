'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function DemoNoticeBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cảnh báo phiên bản thử nghiệm"
      className="bg-amber-500/10 border-b border-amber-500/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-200 dark:bg-amber-800/60 px-1.5 py-0.5 rounded mr-1">
              Bản thử nghiệm MVP
            </span>
            <span>
              Mọi nội dung bài tập và quy tắc đều là <strong>minh họa kỹ thuật (demo)</strong>, chưa qua thẩm định y khoa/thể thao.
              AI không tự chẩn đoán, không kết luận hồi phục và không tự đổi tải tập.
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-amber-700 dark:text-amber-300 hover:opacity-80 p-0.5 shrink-0"
          title="Ẩn thông báo"
          aria-label="Đóng cảnh báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
