'use client';

import React from 'react';
import { DatabaseZap, ExternalLink } from 'lucide-react';

interface CredentialStatusBannerProps {
  isConfigured: boolean;
  missingKeys?: string[];
}

export function CredentialStatusBanner({ isConfigured, missingKeys = [] }: CredentialStatusBannerProps) {
  if (isConfigured) return null;

  return (
    <div className="m-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-900 dark:text-rose-200 text-xs shadow-sm">
      <div className="flex items-start gap-2.5">
        <DatabaseZap className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-rose-950 dark:text-rose-100 text-sm">
            Chưa cấu hình Supabase credentials
          </p>
          <p className="leading-relaxed text-rose-800/90 dark:text-rose-300">
            Hệ thống đang hoạt động ở chế độ kiểm tra độc lập (Standalone Mode). Các tính năng đăng nhập và lưu dữ liệu trực tiếp vào cơ sở dữ liệu tạm thời chưa khả dụng.
          </p>
          {missingKeys.length > 0 && (
            <div className="pt-1">
              <span className="font-medium text-[11px] text-rose-700 dark:text-rose-400">Thiếu biến môi trường: </span>
              <code className="bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded text-[11px] font-mono text-rose-900 dark:text-rose-200">
                {missingKeys.join(', ')}
              </code>
            </div>
          )}
          <p className="pt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80 flex items-center gap-1">
            <span>Vui lòng tạo tệp <code>.env.local</code> dựa theo mẫu <code>.env.example</code> và khởi động Supabase.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
