'use client';

import React, { useState, useTransition } from 'react';
import { X, Calendar, AlertCircle, Loader2, MapPin, FileText } from 'lucide-react';
import { createMeetupAction, updateMeetupAction } from '@/app/groups/actions';
import { GroupMeetupEntity } from '@/contracts/group.contract';

interface MeetupFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  existingMeetup?: GroupMeetupEntity | null;
}

export function MeetupFormModal({
  isOpen,
  onClose,
  groupId,
  existingMeetup,
}: MeetupFormModalProps) {
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(existingMeetup);

  // Chuyển ISO sang định dạng datetime-local (YYYY-MM-DDTHH:mm)
  const defaultScheduledTime = existingMeetup?.scheduled_at
    ? new Date(existingMeetup.scheduled_at).toISOString().slice(0, 16)
    : '';

  const [title, setTitle] = useState(existingMeetup?.title || '');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledTime);
  const [location, setLocation] = useState(existingMeetup?.location || '');
  const [notes, setNotes] = useState(existingMeetup?.notes || '');
  const [revisionNote, setRevisionNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (title.trim().length < 3) {
      setErrorMsg('Tiêu đề buổi hẹn cần ít nhất 3 ký tự.');
      return;
    }
    if (!scheduledAt) {
      setErrorMsg('Vui lòng chọn thời gian hẹn.');
      return;
    }

    const isoScheduledAt = new Date(scheduledAt).toISOString();

    startTransition(async () => {
      if (isEditing && existingMeetup) {
        const res = await updateMeetupAction(
          {
            meetup_id: existingMeetup.id,
            title: title.trim(),
            scheduled_at: isoScheduledAt,
            location: location.trim() || undefined,
            notes: notes.trim() || undefined,
            revision_note: revisionNote.trim() || 'Cập nhật lại thời gian hoặc địa điểm',
          },
          groupId
        );

        if (!res.success) {
          setErrorMsg(res.message || 'Không thể cập nhật buổi hẹn.');
          return;
        }
      } else {
        const res = await createMeetupAction({
          group_id: groupId,
          title: title.trim(),
          scheduled_at: isoScheduledAt,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Không thể tạo buổi hẹn.');
          return;
        }
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
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">
                {isEditing ? `Sửa lịch hẹn (Lần ${existingMeetup!.revision + 1})` : 'Hẹn buổi tập chung'}
              </h2>
              <span className="text-[11px] text-slate-500 font-normal">
                Hoạt động hẹn gặp nhóm • Không tự ghi nhật ký cá nhân
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

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề buổi hẹn <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="VD: Buổi tập xà chung tại Công viên Gia Định"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Thời gian hẹn <span className="text-rose-500">*</span>
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Địa điểm (tùy chọn)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={200}
                placeholder="VD: Cổng Hoàng Minh Giám, gần khu xà"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú nội dung tập (tùy chọn)
            </label>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="VD: Khởi động 10 phút, tập kéo xà và cơ bụng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {isEditing && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1.5">
              <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200">
                Lý do / Ghi chú sửa đổi (Lưu revision) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={200}
                placeholder="VD: Dời sang 6h30 sáng do trời mưa..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 block">
                Khi sửa lịch, phiên bản sẽ tự động tăng và người tham gia sẽ được yêu cầu xác nhận lại.
              </span>
            </div>
          )}

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
              disabled={isPending || title.trim().length < 3 || !scheduledAt}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isPending ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo buổi hẹn'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
