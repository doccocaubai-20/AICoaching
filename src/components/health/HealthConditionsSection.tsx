'use client';

import React, { useState, useTransition } from 'react';
import { Stethoscope, Plus, Trash2, X, AlertCircle, ShieldAlert } from 'lucide-react';
import { HealthConditionEntity, ConditionCategory, ConditionStatus } from '@/contracts';
import { addHealthConditionAction, updateHealthConditionStatusAction, deleteHealthConditionAction } from '@/lib/server/health-profile-actions';

interface HealthConditionsSectionProps {
  conditions: HealthConditionEntity[];
  isConfigured: boolean;
}

const CATEGORY_MAP: Record<ConditionCategory, { label: string; color: string }> = {
  diagnosed_condition: { label: 'Chẩn đoán tự khai', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
  injury: { label: 'Chấn thương', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  self_reported_symptom: { label: 'Triệu chứng tự kể', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
};

const STATUS_MAP: Record<ConditionStatus, { label: string; dot: string }> = {
  active: { label: 'Đang theo dõi', dot: 'bg-rose-500' },
  monitoring: { label: 'Tạm ổn định', dot: 'bg-amber-500' },
  resolved: { label: 'Đã hồi phục', dot: 'bg-emerald-500' },
};

export function HealthConditionsSection({ conditions, isConfigured }: HealthConditionsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ConditionCategory>('injury');
  const [status, setStatus] = useState<ConditionStatus>('active');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Vui lòng nhập tên tình trạng hoặc chấn thương.');
      return;
    }

    startTransition(async () => {
      const res = await addHealthConditionAction({
        name: name.trim(),
        category,
        status,
        notes: notes.trim() || null,
      });

      if (res.success) {
        setIsModalOpen(false);
        setName('');
        setNotes('');
      } else {
        setFormError(res.message || 'Lỗi lưu thông tin.');
      }
    });
  };

  const handleStatusChange = (id: string, newStatus: ConditionStatus) => {
    startTransition(async () => {
      await updateHealthConditionStatusAction(id, newStatus);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
    startTransition(async () => {
      await deleteHealthConditionAction(id);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Tình trạng sức khỏe & Chấn thương
            </h3>
            <p className="text-[11px] text-slate-500">
              Phân biệt bệnh tự khai, chấn thương và triệu chứng
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-1.5 px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Khai báo</span>
        </button>
      </div>

      {conditions.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500">
          Chưa ghi nhận chấn thương hoặc tình trạng nào cần lưu ý.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {conditions.map((item) => {
            const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.injury;
            const st = STATUS_MAP[item.status] || STATUS_MAP.active;

            return (
              <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {item.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat.color}`}>
                      {cat.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      &quot;{item.notes}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value as ConditionStatus)}
                    className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-medium"
                  >
                    <option value="active">Đang theo dõi</option>
                    <option value="monitoring">Tạm ổn định</option>
                    <option value="resolved">Đã hồi phục</option>
                  </select>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Khai Báo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <span>Khai Báo Tình Trạng Sức Khỏe</span>
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
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tên tình trạng / Vị trí chấn thương:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ví dụ: Đau khớp cổ tay trái, Đau vai, Hen suyễn..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Phân loại:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ConditionCategory)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="injury">Chấn thương cơ xương khớp</option>
                  <option value="self_reported_symptom">Triệu chứng tự kể (nhức mỏi, chóng mặt...)</option>
                  <option value="diagnosed_condition">Bệnh đã được bác sĩ chẩn đoán</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Trạng thái:
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ConditionStatus)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="active">Đang theo dõi (Có ảnh hưởng tập luyện)</option>
                  <option value="monitoring">Tạm ổn định</option>
                  <option value="resolved">Đã khỏi hẳn</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Ghi chú chi tiết:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Đau nhói khi chống đẩy góc 90 độ..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-[10px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>Ứng dụng lưu trữ để AI hỗ trợ an toàn vận động; không thay thế chẩn đoán từ bác sĩ.</span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition disabled:opacity-50"
                >
                  {isPending ? 'Đang lưu...' : 'Lưu tình trạng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
