'use client';

import React, { useState, useTransition } from 'react';
import {
  ActivitySquare,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  createObservationAction,
  deleteObservationAction,
  ActionResult,
} from '@/app/profile/actions';
import { ObservationEntity, MetricType } from '@/contracts';
import { formatDateVN, getTodayVNDateString, formatSourceLabel } from '@/components/dashboard/date-utils';

interface ObservationsManagerProps {
  initialObservations: ObservationEntity[];
  isConfigured: boolean;
  fetchError?: string | null;
}

export function ObservationsManager({ initialObservations, isConfigured, fetchError }: ObservationsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [metricType, setMetricType] = useState<MetricType>('weight');
  const [metricValue, setMetricValue] = useState('');
  const [observedAtDate, setObservedAtDate] = useState(() => getTodayVNDateString());
  const [notes, setNotes] = useState('');

  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  // Tìm quan sát mới nhất của cân nặng và chiều cao
  const latestWeight = initialObservations.find((o) => o.metric_type === 'weight');
  const latestHeight = initialObservations.find((o) => o.metric_type === 'height');

  const handleCreateObservation = (e: React.FormEvent) => {
    e.preventDefault();
    setActionResult(null);

    const formData = new FormData();
    formData.set('metric_type', metricType);
    formData.set('metric_value', metricValue);
    formData.set('metric_unit', metricType === 'weight' ? 'kg' : 'cm');
    formData.set('observed_at', `${observedAtDate}T12:00:00.000Z`);
    if (notes) formData.set('notes', notes);

    startTransition(async () => {
      const res = await createObservationAction(null, formData);
      setActionResult(res);
      if (res.success) {
        setMetricValue('');
        setNotes('');
        setShowAddForm(false);
      }
    });
  };

  const handleDeleteObservation = (observationId: string, metricLabel: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bản ghi chỉ số ${metricLabel}?`)) {
      return;
    }
    setActionResult(null);
    startTransition(async () => {
      const res = await deleteObservationAction(observationId);
      setActionResult(res);
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          <ActivitySquare className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Chỉ số thể chất tự khai (Tùy chọn)
          </h2>
        </div>

        <button
          type="button"
          disabled={!isConfigured || isPending}
          onClick={() => {
            setShowAddForm(!showAddForm);
            setActionResult(null);
          }}
          className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/60 font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Đóng form' : 'Ghi nhận'}</span>
        </button>
      </div>

      {/* Cam kết không suy luận y khoa */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Quy định an toàn số liệu</span>
        </div>
        <p>
          Chiều cao và cân nặng hoàn toàn <strong>tùy chọn</strong>. Dữ liệu chỉ ghi nhận số tự khai kèm ngày và nguồn, <strong>không tạo điểm sức khỏe tổng hợp</strong> và <strong>không suy luận y khoa</strong>.
        </p>
      </div>

      {fetchError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
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

      {/* 2 Thẻ tóm tắt chỉ số mới nhất (Đánh dấu rõ khi thiếu, KHÔNG hiển thị 0) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Cân nặng tự khai</span>
            {latestWeight ? (
              <div className="mt-1">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {latestWeight.metric_value}
                </span>
                <span className="text-xs text-slate-500 ml-1">{latestWeight.metric_unit}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic block mt-1">{fetchError ? '—' : 'Chưa ghi nhận (Tùy chọn)'}</span>
            )}
          </div>
          {latestWeight && (
            <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-200/50 dark:border-slate-800 pt-1">
              {formatDateVN(latestWeight.observed_at)} • Nguồn: {formatSourceLabel(latestWeight.source)}
            </p>
          )}
        </div>

        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Chiều cao tự khai</span>
            {latestHeight ? (
              <div className="mt-1">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {latestHeight.metric_value}
                </span>
                <span className="text-xs text-slate-500 ml-1">{latestHeight.metric_unit}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic block mt-1">{fetchError ? '—' : 'Chưa ghi nhận (Tùy chọn)'}</span>
            )}
          </div>
          {latestHeight && (
            <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-200/50 dark:border-slate-800 pt-1">
              {formatDateVN(latestHeight.observed_at)} • Nguồn: {formatSourceLabel(latestHeight.source)}
            </p>
          )}
        </div>
      </div>

      {/* Form thêm chỉ số mới (Giữ form khi lỗi) */}
      {showAddForm && (
        <form
          onSubmit={handleCreateObservation}
          className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
        >
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Thêm lượt ghi nhận chỉ số mới
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Loại chỉ số
              </label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value as MetricType)}
                disabled={isPending}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="weight">Cân nặng (kg)</option>
                <option value="height">Chiều cao (cm)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Giá trị ({metricType === 'weight' ? 'kg' : 'cm'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="10"
                max="300"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                placeholder={metricType === 'weight' ? 'VD: 65.5' : 'VD: 172'}
                disabled={isPending}
                required
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày ghi nhận
              </label>
              <input
                type="date"
                value={observedAtDate}
                onChange={(e) => setObservedAtDate(e.target.value)}
                disabled={isPending}
                required
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú (Tùy chọn)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Cân buổi sáng lúc đói..."
                disabled={isPending}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPending ? 'Đang lưu...' : 'Lưu chỉ số'}
            </button>
          </div>
        </form>
      )}

      {/* Lịch sử ghi nhận */}
      {initialObservations.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Lịch sử các lần tự khai gần đây
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {initialObservations.map((obs) => (
              <div
                key={obs.id}
                className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {obs.metric_type === 'weight' ? 'Cân nặng' : obs.metric_type === 'height' ? 'Chiều cao' : obs.metric_type}: {obs.metric_value} {obs.metric_unit}
                  </span>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateVN(obs.observed_at)}</span>
                    <span>•</span>
                    <span>Nguồn: {formatSourceLabel(obs.source)}</span>
                    {obs.notes && <span>• {obs.notes}</span>}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!isConfigured || isPending}
                  onClick={() =>
                    handleDeleteObservation(
                      obs.id,
                      `${obs.metric_type === 'weight' ? 'cân nặng' : 'chiều cao'} ${obs.metric_value}${obs.metric_unit}`
                    )
                  }
                  title="Xóa bản ghi"
                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
