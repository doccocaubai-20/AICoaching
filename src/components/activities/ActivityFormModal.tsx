'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  CalendarCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  ActivityEntity,
  ActivityType,
  newIdempotencyKey,
} from '@/contracts';
import {
  createActivityAction,
  updateActivityAction,
  ActionResult,
} from '@/app/activities/actions';
import {
  localDatetimeToIso,
  isoToVNDatetimeLocal,
  getVietnamNowDatetimeLocal,
  ACTIVITY_TYPE_LABELS,
  validateActivityDuration,
} from './activity-utils';

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialActivity?: ActivityEntity | null;
  isConfigured: boolean;
  onSuccess?: () => void;
}

export function ActivityFormModal({
  isOpen,
  onClose,
  mode,
  initialActivity,
  isConfigured,
  onSuccess,
}: ActivityFormModalProps) {
  const [activityType, setActivityType] = useState<ActivityType>('calisthenics');
  const [isPlanned, setIsPlanned] = useState(false);
  const [localDatetime, setLocalDatetime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [fatigueLevel, setFatigueLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  // Khởi tạo state khi mở modal:
  // - Mode create: sinh newIdempotencyKey() MỘT LẦN duy nhất khi mở form, giữ trong state.
  // - Mode edit: dùng lại idempotency_key gốc, điền lại thời gian theo giờ Việt Nam.
  useEffect(() => {
    if (!isOpen) return;

    setActionResult(null);

    if (mode === 'edit' && initialActivity) {
      setActivityType(initialActivity.activity_type);
      setIsPlanned(initialActivity.is_planned);
      setLocalDatetime(isoToVNDatetimeLocal(initialActivity.start_at));
      setDurationMinutes(String(initialActivity.duration_minutes));
      setFatigueLevel(
        initialActivity.fatigue_level !== null && initialActivity.fatigue_level !== undefined
          ? String(initialActivity.fatigue_level)
          : ''
      );
      setNotes(initialActivity.notes || '');
      setIdempotencyKey(initialActivity.idempotency_key);
    } else {
      // Mode create: sinh khóa mới cho lượt tạo mới này
      setActivityType('calisthenics');
      setIsPlanned(false);
      setLocalDatetime(getVietnamNowDatetimeLocal());
      setDurationMinutes('45');
      setFatigueLevel('');
      setNotes('');
      setIdempotencyKey(newIdempotencyKey());
    }
  }, [isOpen, mode, initialActivity]);

  if (!isOpen) return null;

  // Trường hợp đang ở mode edit nhưng chưa tải được bản ghi gốc: khóa form để không ghi đè dữ liệu thật
  const isRecordMissingInEditMode = mode === 'edit' && !initialActivity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionResult(null);

    // 1. Kiểm tra thời lượng ở client trước khi submit
    const durNum = parseInt(durationMinutes, 10);
    const durCheck = validateActivityDuration(durNum);
    if (!durCheck.isValid) {
      setActionResult({
        success: false,
        message: durCheck.error || 'Thời lượng không hợp lệ.',
      });
      return;
    }

    // 2. Chuyển đổi giờ địa phương từ input type="datetime-local" sang ISO-8601 ngay ở trình duyệt
    const isoStartAt = localDatetimeToIso(localDatetime);
    if (!isoStartAt) {
      setActionResult({
        success: false,
        message: 'Vui lòng chọn ngày và giờ bắt đầu hợp lệ.',
      });
      return;
    }

    const formData = new FormData();
    formData.set('activity_type', activityType);
    formData.set('is_planned', isPlanned ? 'true' : 'false');
    formData.set('start_at', isoStartAt);
    formData.set('duration_minutes', String(durNum));
    if (fatigueLevel && fatigueLevel.trim() !== '') {
      formData.set('fatigue_level', fatigueLevel.trim());
    }
    if (notes && notes.trim() !== '') {
      formData.set('notes', notes.trim());
    }

    startTransition(async () => {
      let res: ActionResult;
      if (mode === 'edit' && initialActivity) {
        formData.set('activity_id', initialActivity.id);
        res = await updateActivityAction(null, formData);
      } else {
        formData.set('idempotency_key', idempotencyKey);
        res = await createActivityAction(null, formData);
      }

      setActionResult(res);

      if (res.success) {
        // Thông báo thành công và đóng modal sau delay ngắn
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 600);
      }
      // Nếu có lỗi: giữ nguyên dữ liệu form để người dùng sửa lại
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {mode === 'edit' ? 'Chỉnh sửa hoạt động' : 'Ghi nhận hoạt động mới'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {mode === 'edit' ? 'Cập nhật chi tiết buổi tập hoặc lịch' : 'Calisthenics, chạy bộ, cầu lông, đi bộ...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {isRecordMissingInEditMode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Chưa tải được dữ liệu hoạt động gốc. Form đã bị khóa để tránh ghi đè dữ liệu.</span>
            </div>
          )}

          {actionResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                actionResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
              }`}
            >
              {actionResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{actionResult.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Loại hoạt động */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Môn tập luyện <span className="text-rose-500">*</span>
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((type) => (
                  <option key={type} value={type}>
                    {ACTIVITY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Trạng thái: Lịch dự kiến vs Đã tập */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPlanned}
                  onChange={(e) => setIsPlanned(e.target.checked)}
                  disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                  className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Đây là lịch dự kiến (Chưa diễn ra)
                </span>
              </label>
              <p className="text-[11px] text-slate-500 mt-1 pl-6">
                {isPlanned
                  ? 'Hoạt động sẽ được đánh dấu là lịch kế hoạch và không tính vào số phút đã tập thực tế.'
                  : 'Hoạt động đã hoàn thành thực tế, tính vào thống kê quá trình rèn luyện.'}
              </p>
            </div>

            {/* Ngày giờ bắt đầu */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Thời gian bắt đầu (Giờ Việt Nam) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={localDatetime}
                  onChange={(e) => setLocalDatetime(e.target.value)}
                  disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Thời gian được chuyển đổi tự động sang chuẩn ISO-8601 tại trình duyệt trước khi lưu.
              </p>
            </div>

            {/* Thời lượng & Mức mệt mỏi */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thời lượng (phút) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                  required
                  placeholder="VD: 45"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mức mệt (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={fatigueLevel}
                  onChange={(e) => setFatigueLevel(e.target.value)}
                  disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                  placeholder="Tùy chọn"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú cá nhân (Tùy chọn)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                placeholder="VD: Cảm thấy cơ xô căng tốt, hiệp cuối hơi đuối..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Ghi chú là văn bản tự do của người dùng; ứng dụng hiển thị dạng thuần an toàn.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isPending}
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPending || !isConfigured || isRecordMissingInEditMode}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {isPending
                  ? mode === 'edit'
                    ? 'Đang cập nhật...'
                    : 'Đang lưu...'
                  : mode === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Lưu hoạt động'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
