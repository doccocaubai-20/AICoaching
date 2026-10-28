'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  Video,
  ChevronDown,
  ChevronUp,
  FileCheck,
  SplitSquareVertical,
} from 'lucide-react';
import type { MilestoneProgress, JourneyAttempt } from '../contracts/skills.contract';

interface MilestoneCardProps {
  progress: MilestoneProgress;
  onRecordAttempt: (milestoneId: string) => void;
  onDeleteAttempt?: (attemptId: string) => void;
}

export function MilestoneCard({
  progress,
  onRecordAttempt,
  onDeleteAttempt,
}: MilestoneCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { milestone, status, attemptsCount, achievedAttemptsCount, latestAttempt, hasVideoAttached } = progress;

  // Render Status Badge
  const renderStatusBadge = () => {
    switch (status) {
      case 'self_reported_achieved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Tự ghi nhận đạt
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Cần xem lại nguồn
          </span>
        );
      case 'attempted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Đã thử ({attemptsCount} lần)
          </span>
        );
      case 'not_attempted':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Chưa thử
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-3.5 transition-all">
      {/* Header mốc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm shrink-0 mt-0.5">
            {milestone.sequenceOrder}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {milestone.title}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Bài tập: <strong>{milestone.exerciseId}</strong></span>
              <span>•</span>
              <span>Biến thể: <strong>{milestone.variantId}</strong></span>
              <span>•</span>
              <span>Hỗ trợ: <strong>{milestone.assistance}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          {renderStatusBadge()}
        </div>
      </div>

      {/* Tiêu chí chi tiết */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 text-xs sm:text-sm space-y-1.5">
        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Tiêu chuẩn đánh giá mốc:</span>
          <span className="text-[11px] font-normal text-slate-500">
            Mục tiêu: {milestone.targetReps ? `${milestone.targetReps} reps` : ''} {milestone.targetDurationSeconds ? `${milestone.targetDurationSeconds} giây` : ''}
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          {milestone.criteriaDescription}
        </p>
      </div>

      {/* Cảnh báo needs_review nếu có */}
      {status === 'needs_review' && latestAttempt?.sourceInvalidationReason && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Bằng chứng liên kết cần kiểm tra lại:</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              {latestAttempt.sourceInvalidationReason}
            </p>
          </div>
        </div>
      )}

      {/* Thông tin lần thử gần nhất */}
      {latestAttempt && (
        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between pt-1 gap-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span>Lần thử gần nhất:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {new Date(latestAttempt.attemptedAt || latestAttempt.attempted_at || Date.now()).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>—</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {latestAttempt.actualReps !== null ? `${latestAttempt.actualReps} lần` : ''}
              {latestAttempt.actualDurationSeconds !== null ? ` ${latestAttempt.actualDurationSeconds}s` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {latestAttempt.videoId && (
              <span className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                <Video className="w-3.5 h-3.5" /> Có clip đối chiếu
              </span>
            )}
            {latestAttempt.sourceRef && (
              <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                <FileCheck className="w-3.5 h-3.5" /> Có nguồn nền
              </span>
            )}
          </div>
        </div>
      )}

      {/* Nút hành động */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRecordAttempt(milestone.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Ghi lần thử mới
          </button>

          {attemptsCount >= 2 && hasVideoAttached && (
            <Link
              href={`/journey/compare?milestoneId=${milestone.id}&exerciseId=${milestone.exerciseId}&variantId=${milestone.variantId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-medium hover:bg-purple-100 transition-colors"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Đối chiếu video (2 clip)
            </Link>
          )}
        </div>

        {attemptsCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
          >
            <span>Lịch sử ({attemptsCount})</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Khối xem lịch sử mở rộng */}
      {showHistory && latestAttempt && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Lịch sử các lần thử của mốc này ({achievedAttemptsCount} lần tự đạt / {attemptsCount} tổng lần):
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <p>
              Hệ thống lưu giữ đầy đủ cả các lần chưa đạt để đối chiếu khách quan với cùng bài tập và biến thể.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
