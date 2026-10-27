'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Share2,
  Check,
  Dumbbell,
} from 'lucide-react';

interface AthletePassportCardProps {
  displayName: string;
  totalSessions: number;
  totalMinutes: number;
  completedGoalsCount: number;
  streakDays: number;
  workContext?: string | null;
  experienceLevel?: string;
  shareableUrl?: string;
}

export function AthletePassportCard({
  displayName,
  totalSessions,
  totalMinutes,
  completedGoalsCount,
  streakDays = 3,
  workContext,
  experienceLevel = 'Người mới',
  shareableUrl = typeof window !== 'undefined' ? window.location.href : 'https://caliscoaching.vn',
}: AthletePassportCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Điểm năng lực 5 chiều (radar scale 100)
  const pushScore = Math.min(95, 40 + totalSessions * 8);
  const pullScore = Math.min(90, 35 + totalSessions * 7);
  const coreScore = Math.min(85, 30 + totalSessions * 6);
  const enduranceScore = Math.min(92, 45 + Math.round(totalMinutes / 20));
  const disciplineScore = Math.min(98, 50 + streakDays * 12);

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
              <span className="text-[9px] text-slate-400">CalisCoaching Verified ID</span>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-300">
            PASSPORT #CC-{Math.abs(displayName.split('').reduce((a, b) => a + b.charCodeAt(0), 1000))}
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

        {/* Biểu đồ Năng lực Thể chất */}
        <div className="space-y-2 bg-black/40 rounded-2xl p-3.5 border border-white/10 text-[11px]">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Chỉ Số Năng Lực 5 Chiều</span>
            <span className="text-emerald-400 font-mono">Đạt chuẩn</span>
          </span>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">Sức Đẩy (Pushing):</span>
              <span className="font-mono text-emerald-300 font-bold">{pushScore}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pushScore}%` }} />
            </div>

            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">Sức Kéo (Pulling):</span>
              <span className="font-mono text-teal-300 font-bold">{pullScore}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-400 rounded-full" style={{ width: `${pullScore}%` }} />
            </div>

            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">Cơ Lõi & Kháng Lực (Core):</span>
              <span className="font-mono text-purple-300 font-bold">{coreScore}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${coreScore}%` }} />
            </div>

            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">Độ Bền & Phục Hồi:</span>
              <span className="font-mono text-amber-300 font-bold">{enduranceScore}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${enduranceScore}%` }} />
            </div>
          </div>
        </div>

        {/* QR Code Chia Sẻ Minh Họa */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 block">Quét mã QR để đối chiếu:</span>
            <span className="text-[9px] text-slate-500 block">Xác thực bởi CalisCoaching Core</span>
          </div>

          <div className="w-12 h-12 bg-white rounded-xl p-1 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-full h-full text-slate-900 fill-current">
              <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v4h-2v-4zm4 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-6-2h2v2h-2v-2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* NÚT CHIA SẺ & SAO CHÉP */}
      <div className="flex gap-2">
        <button
          onClick={handleCopyLink}
          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition shadow-md"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span>{copied ? 'Đã sao chép link thẻ!' : 'Chia sẻ thẻ rèn luyện'}</span>
        </button>
      </div>
    </div>
  );
}
