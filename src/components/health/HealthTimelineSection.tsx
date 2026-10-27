'use client';

import React, { useState, useTransition } from 'react';
import { Calendar, Plus, FileText, X, AlertCircle } from 'lucide-react';
import { HealthEventEntity, HealthEventType } from '@/contracts';
import { addHealthEventAction, deleteHealthEventAction } from '@/lib/server/health-profile-actions';

interface HealthTimelineSectionProps {
  events: HealthEventEntity[];
  isConfigured: boolean;
}

const EVENT_TYPE_MAP: Record<HealthEventType, { label: string; icon: string }> = {
  checkup: { label: 'Khám sức khỏe', icon: '🩺' },
  lab_test: { label: 'Xét nghiệm', icon: '🧪' },
  vaccination: { label: 'Tiêm chủng', icon: '💉' },
  other: { label: 'Sự kiện y tế khác', icon: '📋' },
};

export function HealthTimelineSection({ events, isConfigured }: HealthTimelineSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventType, setEventType] = useState<HealthEventType>('checkup');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [facilityName, setFacilityName] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await addHealthEventAction({
        event_type: eventType,
        event_date: eventDate,
        facility_name: facilityName.trim() || null,
        notes: notes.trim() || null,
      });

      if (res.success) {
        setIsModalOpen(false);
        setFacilityName('');
        setNotes('');
      } else {
        setErrorMsg(res.message || 'Lỗi lưu sự kiện.');
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Dòng Thời Gian Y Tế & Khám Bệnh
            </h3>
            <p className="text-[11px] text-slate-500">
              Lưu giữ lịch sử khám, xét nghiệm và tiêm chủng
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm sự kiện</span>
        </button>
      </div>

      {events.length === 0 ? (
        <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500">
          Chưa có sự kiện khám bệnh hoặc xét nghiệm nào được lưu.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {events.map((evt) => {
            const typeInfo = EVENT_TYPE_MAP[evt.event_type] || EVENT_TYPE_MAP.other;

            return (
              <div key={evt.id} className="relative group text-xs space-y-1">
                {/* Node icon */}
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] ring-4 ring-white dark:ring-slate-900">
                  {typeInfo.icon}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {typeInfo.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(evt.event_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {evt.facility_name && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                      📍 {evt.facility_name}
                    </p>
                  )}

                  {evt.notes && (
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      &quot;{evt.notes}&quot;
                    </p>
                  )}

                  <div className="pt-1.5 flex justify-end">
                    <button
                      onClick={() =>
                        startTransition(() => {
                          deleteHealthEventAction(evt.id);
                        })
                      }
                      className="text-[10px] text-slate-400 hover:text-rose-600 transition"
                    >
                      Xóa sự kiện
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm Sự Kiện */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Thêm Sự Kiện Y Tế</span>
              </h4>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
              {errorMsg && <div className="p-2 text-rose-600 bg-rose-50 rounded-xl">{errorMsg}</div>}
              <div>
                <label className="font-semibold block mb-1">Loại sự kiện:</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as HealthEventType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                >
                  <option value="checkup">Khám tổng quát / chuyên khoa</option>
                  <option value="lab_test">Xét nghiệm máu / chụp chiếu</option>
                  <option value="vaccination">Tiêm chủng vaccine</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Ngày thực hiện:</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Cơ sở y tế / Bệnh viện:</label>
                <input
                  type="text"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="Ví dụ: Bệnh viện Bạch Mai, Phòng khám..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Ghi chú kết luận:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Men gan hơi cao, chỉ số mỡ máu ổn định..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Lưu sự kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
