import React from 'react';
import Link from 'next/link';
import { Target, Lock, AlertCircle } from 'lucide-react';
import { getJourneyDetailsAction } from '@/features/skills/server/skills-actions';
import { JourneyClientContainer } from './JourneyClientContainer';

export const dynamic = 'force-dynamic';

export default async function JourneyPage() {
  const result = await getJourneyDetailsAction('pull_up_mastery');

  if (!result.success || !result.data) {
    if (result.errorCode === 'UNAUTHORIZED') {
      return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Yêu cầu Đăng nhập
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hành trình kỹ năng lưu giữ các lần thử và clip đối chiếu riêng tư của tài khoản. Vui lòng đăng nhập để bắt đầu theo dõi.
          </p>
          <div className="pt-2">
            <Link
              href="/login?next=/journey"
              className="inline-block w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-800 shadow-sm text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Không thể tải hành trình kỹ năng
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {result.message || 'Đã có lỗi xảy ra trong quá trình truy vấn dữ liệu.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-xs text-emerald-600 hover:underline font-medium pt-2"
        >
          Quay lại Bảng tổng quan
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6">
      <JourneyClientContainer initialDetails={result.data} />
    </main>
  );
}
