'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Clock, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { GroupInvitePreview } from '@/contracts/group.contract';
import { acceptInviteAction } from '@/app/groups/actions';

interface GroupInvitePreviewCardProps {
  preview: GroupInvitePreview;
  rawToken: string;
  isLoggedIn: boolean;
}

export function GroupInvitePreviewCard({
  preview,
  rawToken,
  isLoggedIn,
}: GroupInvitePreviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAccept = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await acceptInviteAction(rawToken);
      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Không thể gia nhập nhóm.');
        return;
      }

      router.push(`/groups/${res.data.groupId}`);
    });
  };

  return (
    <div className="max-w-md mx-auto p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
            Lời mời tham gia nhóm
          </span>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {preview.group_name || 'Nhóm giữ cam kết'}
          </h2>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Thông tin xem trước an toàn */}
      <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
        {preview.group_description && (
          <p className="italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
            &quot;{preview.group_description}&quot;
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Người mời:</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {preview.inviter_display_name || 'Người quen'}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Thành viên:</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {preview.member_count}/5 người
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Múi giờ nhóm: {preview.group_timezone}</span>
        </div>
      </div>

      {/* Nguyên tắc bảo mật xem trước */}
      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Bảo mật dữ liệu trước khi gia nhập</span>
        </div>
        <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed">
          Xem trước lời mời không tự động làm bạn gia nhập. Bạn chỉ gia nhập khi chủ động xác nhận bên dưới. Nhóm không truy cập hồ sơ y tế hay nhật ký riêng của bạn.
        </p>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        {!preview.is_valid ? (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 text-center">
            {preview.invalid_reason || 'Lời mời này không còn hiệu lực.'}
          </div>
        ) : !isLoggedIn ? (
          <Link
            href={`/login?redirect=/groups/invite/${rawToken}`}
            className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            Đăng nhập để chấp nhận lời mời
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isPending ? 'Đang gia nhập...' : 'Chấp thuận & Gia nhập nhóm'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
