'use client';

import React, { useTransition } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  FileText,
  Edit2,
  Trash2,
  Tag,
  Dumbbell,
} from 'lucide-react';
import { ActivityEntity } from '@/contracts';
import { formatDateVN, formatSourceLabel } from '@/components/dashboard/date-utils';
import { deleteActivityAction } from '@/app/activities/actions';
import { ACTIVITY_TYPE_LABELS } from './activity-utils';

interface ActivityItemProps {
  activity: ActivityEntity;
  onEdit: (activity: ActivityEntity) => void;
  isConfigured: boolean;
}

export function ActivityItem({ activity, onEdit, isConfigured }: ActivityItemProps) {
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    const typeLabel = ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type;
    const timeLabel = formatDateVN(activity.start_at, { hour: '2-digit', minute: '2-digit' });
    const message = `Bạn có chắc chắn muốn xóa hoạt động ${typeLabel} (${timeLabel})? Hành động này sẽ tự động cập nhật lại các gợi ý liên quan.`;

    if (!window.confirm(message)) {
      return;
    }

    startDeleteTransition(async () => {
      const res = await deleteActivityAction(activity.id);
      if (!res.success) {
        alert(res.message || 'Không thể xóa hoạt động. Vui lòng thử lại.');
      }
    });
  };

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
        activity.is_planned
          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/70 dark:border-blue-900/40'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      } shadow-xs space-y-2.5`}
    >
      {/* Header dòng: Loại môn, nhãn kế hoạch/đã tập, nút sửa/xóa */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
            {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
          </span>

          {/* Nhãn trạng thái */}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              activity.is_planned
                ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            {activity.is_planned ? 'Lịch dự kiến' : 'Đã tập'}
          </span>

          {/* Nhãn nguồn dữ liệu */}
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
            Nguồn: {formatSourceLabel(activity.source)}
          </span>
        </div>

        {/* Nút thao tác Sửa / Xóa */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!isConfigured || isDeleting}
            onClick={() => onEdit(activity)}
            className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Chỉnh sửa hoạt động"
            aria-label="Chỉnh sửa hoạt động"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!isConfigured || isDeleting}
            onClick={handleDelete}
            className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-40"
            title="Xóa hoạt động"
            aria-label="Xóa hoạt động"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Thông số chính: Thời gian bắt đầu, thời lượng, mức mệt */}
      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDateVN(activity.start_at, { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{activity.duration_minutes} phút</span>
        </div>

        {activity.fatigue_level !== null && activity.fatigue_level !== undefined && (
          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Mức mệt: <strong className="text-slate-800 dark:text-slate-200">{activity.fatigue_level}</strong>/10</span>
          </div>
        )}
      </div>

      {/* Ghi chú cá nhân (Untrusted input - render văn bản thuần an toàn) */}
      {activity.notes && (
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap break-words leading-relaxed">{activity.notes}</p>
        </div>
      )}
    </div>
  );
}
