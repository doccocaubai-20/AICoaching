'use client';

import React, { useState, useTransition } from 'react';
import { HeartPulse, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { BloodPressureEntity } from '@/contracts';
import { addBloodPressureAction, deleteBloodPressureAction } from '@/lib/server/health-profile-actions';

interface BloodPressureSectionProps {
  readings: BloodPressureEntity[];
  isConfigured: boolean;
}

export function BloodPressureSection({ readings, isConfigured }: BloodPressureSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latestReading = readings.length > 0 ? readings[0] : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const sysNum = parseInt(systolic, 10);
    const diaNum = parseInt(diastolic, 10);

    if (isNaN(sysNum) || isNaN(diaNum)) {
      setFormError('Vui lòng nhập số hợp lệ.');
      return;
    }

    if (sysNum <= diaNum) {
      setFormError('Huyết áp tâm thu phải lớn hơn huyết áp tâm trương.');
      return;
    }

    startTransition(async () => {
      const res = await addBloodPressureAction({
        systolic: sysNum,
        diastolic: diaNum,
        notes: notes.trim() || null,
        source: 'self_reported',
      });

      if (res.success) {
        setIsModalOpen(false);
        setNotes('');
      } else {
        setFormError(res.message || 'Lỗi lưu huyết áp.');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi huyết áp này?')) return;
    startTransition(async () => {
      await deleteBloodPressureAction(id);
    });
  };

  // Phân loại trực quan tham khảo
  const getBPStatus = (sys: number, dia: number) => {
    if (sys < 120 && dia < 80) return { label: 'Tối ưu', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60' };
    if (sys <= 129 && dia <= 84) return { label: 'Bình thường', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60' };
    if (sys <= 139 || dia <= 89) return { label: 'Tiền tăng HA', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' };
    return { label: 'Cần chú ý', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60' };
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Huyết áp (Tâm thu / Tâm trương)
            </h3>
            <p className="text-[11px] text-slate-500">
              Lưu 2 chỉ số độc lập trong cùng lần đo (mmHg)
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm số đo</span>
        </button>
      </div>

      {/* Hiển thị số đo gần nhất */}
      {latestReading ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block">Số đo mới nhất:</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {latestReading.systolic}/{latestReading.diastolic}
              </span>
              <span className="text-xs text-slate-500 font-medium">mmHg</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Đo lúc: {new Date(latestReading.measured_at).toLocaleDateString('vi-VN')}
            </span>
          </div>

          <div className="text-right space-y-1">
            {(() => {
              const st = getBPStatus(latestReading.systolic, latestReading.diastolic);
              return (
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${st.color}`}>
                  {st.label}
                </span>
              );
            })()}
            <p className="text-[9px] text-slate-400">Tham khảo chuẩn</p>
          </div>
        </div>
      ) : (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500">
          Chưa có bản ghi huyết áp nào. Nhấn &quot;Thêm số đo&quot; để ghi nhận.
        </div>
      )}

      {/* Lịch sử gần đây */}
      {readings.length > 1 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Lịch sử các lần đo gần đây:
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-36 overflow-y-auto pr-1">
            {readings.slice(1, 5).map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {r.systolic}/{r.diastolic} mmHg
                  </span>
                  <span className="text-[10px] text-slate-400 ml-2">
                    {new Date(r.measured_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-slate-400 hover:text-rose-600 transition"
                  title="Xóa bản ghi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nhập Huyết Áp */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                <span>Nhập Số Đo Huyết Áp</span>
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Tâm thu (Systolic):
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="300"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    required
                    placeholder="120"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-bold text-sm"
                  />
                  <span className="text-[10px] text-slate-400">Chỉ số trên (mmHg)</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Tâm trương (Diastolic):
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    required
                    placeholder="80"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-bold text-sm"
                  />
                  <span className="text-[10px] text-slate-400">Chỉ số dưới (mmHg)</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Ghi chú (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Đo sau khi thức dậy..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Lưu chỉ số'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
