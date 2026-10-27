'use client';

import React, { useState } from 'react';
import {
  Flame,
  Share2,
  Check,
  Dumbbell,
} from 'lucide-react';
import {
  generatePassportId,
  generateQRCodePath,
} from '@/lib/passport/passport-utils';
import { createPassportShareAction, revokePassportShareAction } from '@/lib/server/passport-share-actions';

interface AthletePassportCardProps {
  userId?: string;
  displayName: string;
  totalSessions: number;
  totalMinutes: number;
  completedGoalsCount: number;
  streakDays?: number;
  workContext?: string | null;
  experienceLevel?: string;
  shareableUrl?: string;
  canManageShare?: boolean;
}

export function AthletePassportCard({
  userId,
  displayName,
  totalSessions,
  totalMinutes,
  completedGoalsCount,
  streakDays = 0,
  workContext: _workContext,
  experienceLevel = 'Người mới',
  shareableUrl = '',
  canManageShare = false,
}: AthletePassportCardProps) {
  const [copied, setCopied] = useState(false);
  const [currentShareUrl, setCurrentShareUrl] = useState<string | null>(shareableUrl || null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleCopyLink = async () => {
    setShareError(null);
    let url = currentShareUrl;
    if (!url && canManageShare) {
      setIsSharing(true);
      const result = await createPassportShareAction();
      setIsSharing(false);
      if (!result.success || !result.token) {
        setShareError(result.error || 'Không thể tạo liên kết chia sẻ.');
        return;
      }
      url = `${window.location.origin}/passport?share=${encodeURIComponent(result.token)}`;
      setCurrentShareUrl(url);
    }

    if (!url) {
      setShareError('Chủ hồ sơ chưa bật liên kết chia sẻ.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareError('Không thể sao chép tự động. Bạn có thể sao chép liên kết bên dưới.');
    }
  };

  const handleRevokeShare = async () => {
    setShareError(null);
    setIsSharing(true);
    const result = await revokePassportShareAction();
    setIsSharing(false);
    if (!result.success) {
      setShareError(result.error || 'Không thể thu hồi liên kết chia sẻ.');
      return;
    }
    setCurrentShareUrl(null);
    setCopied(false);
  };

  return (
    <div className="space-y-5 max-w-sm mx-auto">
      {/* THẺ ATHLETE PASSPORT SANG TRỌNG */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-5">
        {/* Hologram ambient light */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Thẻ Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block leading-tight">
                Athlete Passport
              </span>
              <span className="text-[9px] text-slate-400">CalisCoaching Member ID</span>
            </div>
          </div>

          <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-300 max-w-[145px] break-all text-right">
            ID {generatePassportId(userId || displayName)}
          </span>
        </div>

        {/* Tên & Danh hiệu */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">{displayName}</h1>
            <p className="text-xs text-indigo-300 font-semibold mt-0.5 flex items-center gap-1">
              <span>{experienceLevel}</span>
              <span>•</span>
              <span className="text-slate-400 text-[11px]">Trạng thái: Tích cực</span>
            </p>
          </div>

          {/* Huy hiệu chuỗi ngày Streak */}
          <div className="text-center bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-2xl shadow-inner">
            <div className="flex items-center justify-center gap-1 text-amber-400 font-black text-sm">
              <Flame className="w-4 h-4 fill-amber-400" />
              <span>{streakDays} Ngày</span>
            </div>
            <span className="text-[9px] text-amber-200/80 block uppercase font-bold tracking-wider">
              Kỷ luật 🔥
            </span>
          </div>
        </div>

        {/* 3 Chỉ số nổi bật */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[9px] text-slate-400 block">Buổi hoàn thành</span>
            <span className="text-base font-black text-emerald-300 font-mono mt-0.5 block">
              {totalSessions}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[9px] text-slate-400 block">Thời gian rèn</span>
            <span className="text-base font-black text-amber-300 font-mono mt-0.5 block">
              {totalMinutes}p
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[9px] text-slate-400 block">Mục tiêu đạt</span>
            <span className="text-base font-black text-purple-300 font-mono mt-0.5 block">
              {completedGoalsCount}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center">
          Thành tích phản ánh nhật ký do bạn ghi nhận; đây không phải bài kiểm tra hay xác nhận năng lực thể chất.
        </p>

        {/* QR chỉ chứa liên kết chia sẻ đã được chủ hồ sơ bật */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 block">{currentShareUrl ? 'Quét để xem hồ sơ đã chia sẻ:' : 'Liên kết chia sẻ đang tắt'}</span>
            <span className="text-[9px] text-slate-500 block">Có thể thu hồi liên kết bất cứ lúc nào</span>
          </div>

          <div className="w-12 h-12 bg-white rounded-xl p-1 flex items-center justify-center shadow-md">
            {currentShareUrl ? (
              <svg viewBox="0 0 24 24" className="w-full h-full text-slate-900 fill-current" aria-label="Mã QR hồ sơ chia sẻ">
                <path d={generateQRCodePath(currentShareUrl)} />
              </svg>
            ) : <span className="text-[7px] leading-tight text-slate-500 text-center">Chưa bật QR</span>}
          </div>
        </div>
      </div>

      {/* NÚT CHIA SẺ & SAO CHÉP */}
      <div className="flex gap-2">
        <button
          onClick={handleCopyLink}
          disabled={isSharing}
          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-60"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span>{isSharing ? 'Đang tạo liên kết...' : copied ? 'Đã sao chép link thẻ!' : currentShareUrl ? 'Sao chép link chia sẻ' : 'Bật và chia sẻ hồ sơ'}</span>
        </button>
        {canManageShare && currentShareUrl && (
          <button
            type="button"
            onClick={handleRevokeShare}
            disabled={isSharing}
            className="py-3 px-3 bg-rose-900/70 hover:bg-rose-800 text-rose-100 font-bold text-[10px] rounded-2xl disabled:opacity-60"
          >
            Thu hồi link
          </button>
        )}
      </div>
      {currentShareUrl && (
        <input
          readOnly
          value={currentShareUrl}
          aria-label="Liên kết chia sẻ Passport"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-[10px] text-slate-300"
        />
      )}
      {shareError && <p role="alert" className="text-[10px] text-rose-300 text-center">{shareError}</p>}
    </div>
  );
}
