'use client';

import React, { useState, useTransition } from 'react';
import { X, Target, AlertCircle, Loader2 } from 'lucide-react';
import { saveCommitmentAction } from '@/app/groups/actions';
import { CommitmentStatus, GroupCommitmentEntity } from '@/contracts/group.contract';
import { formatWeekRangeVN } from './group-utils';

interface CommitmentFormModalProps {
  isOpen: boolean;
  initialDraft?: {content:string;notes:string} | null;
  onClose: () => void;
  groupId: string;
  weekStart: string;
  existingCommitment?: GroupCommitmentEntity | null;
}

export function CommitmentFormModal({
  isOpen,
  onClose,
  groupId,
  weekStart,
  existingCommitment, initialDraft,
}: CommitmentFormModalProps) {
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState(existingCommitment?.content || initialDraft?.content || '');
  const [targetCount, setTargetCount] = useState<string>(
    existingCommitment?.target_count ? String(existingCommitment.target_count) : ''
  );
  const [completedCount, setCompletedCount] = useState<number>(
    existingCommitment?.completed_count || 0
  );
  const [status, setStatus] = useState<CommitmentStatus>(
    existingCommitment?.status || 'planned'
  );
  const [notes, setNotes] = useState([existingCommitment?.notes,initialDraft?.notes].filter(Boolean).join('\n'));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (content.trim().length < 3) {
      setErrorMsg('Nội dung cam kết cần có ít nhất 3 ký tự.');
      return;
    }

    const targetNum = targetCount.trim() !== '' ? Number(targetCount) : null;
    if (targetNum !== null && (isNaN(targetNum) || targetNum < 1 || targetNum > 50)) {
      setErrorMsg('Mục tiêu số lần phải từ 1 đến 50.');
      return;
    }

    startTransition(async () => {
      const res = await saveCommitmentAction({
        group_id: groupId,
        week_start: weekStart,
        content: content.trim(),
        target_count: targetNum,
        completed_count: completedCount,
        status,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Không thể lưu cam kết.');
        return;
      }

      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">
                {existingCommitment ? 'Chỉnh sửa cam kết tuần' : 'Đặt cam kết tuần mới'}
              </h2>
              <span className="text-[11px] text-slate-500 font-normal">
                {formatWeekRangeVN(weekStart)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {initialDraft && <p className="text-xs text-emerald-700">Bản nháp từ buổi tập của bạn. Kiểm tra nội dung và số buổi trước khi bấm lưu; tiến độ không tự tăng.</p>}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nội dung cam kết cá nhân <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              maxLength={500}
              placeholder="VD: Tập calisthenics 3 buổi (Pull/Push/Core), ngủ đủ 7 tiếng và giãn cơ..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">{content.length}/500 ký tự</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Số lần mục tiêu (tùy chọn)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="VD: 3"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Đã hoàn thành (lần)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={completedCount}
                onChange={(e) => setCompletedCount(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Trạng thái thực hiện
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CommitmentStatus)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="planned">Dự định</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="rescheduled">Dời lịch</option>
              <option value="needs_companion">Cần đồng hành (tìm bạn tập cùng)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú riêng cho nhóm (tùy chọn)
            </label>
            <input
              type="text"
              maxLength={500}
              placeholder="VD: Tuần này bận thứ 4, sẽ tập bù vào thứ 7..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-lg transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending || content.trim().length < 3}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isPending ? 'Đang lưu...' : 'Lưu cam kết'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
