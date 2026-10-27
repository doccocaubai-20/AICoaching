'use client';

import React, { useState, useTransition } from 'react';
import {
  User,
  Wrench,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { updateProfileAction, ActionResult } from '@/app/profile/actions';
import { ExperienceLevel, ProfileScheduleDay } from '@/contracts';

interface ProfileEditFormProps {
  initialProfile: {
    display_name: string;
    experience_level: ExperienceLevel;
    available_equipment: string[];
    schedule_availability: ProfileScheduleDay[];
  };
  isConfigured: boolean;
  fetchError?: string | null;
}

const COMMON_EQUIPMENT = [
  'Sàn nhà',
  'Xà đơn (Pull-up bar)',
  'Dây kháng lực (Resistance band)',
  'Xà kép (Dip bars)',
  'Ghế tập / Bục nhảy',
  'Vòng treo (Gymnastic rings)',
  'Tạ đeo / Tạ tay',
];

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'T2', name: 'Thứ Hai' },
  { id: 'tuesday', label: 'T3', name: 'Thứ Ba' },
  { id: 'wednesday', label: 'T4', name: 'Thứ Tư' },
  { id: 'thursday', label: 'T5', name: 'Thứ Năm' },
  { id: 'friday', label: 'T6', name: 'Thứ Sáu' },
  { id: 'saturday', label: 'T7', name: 'Thứ Bảy' },
  { id: 'sunday', label: 'CN', name: 'Chủ Nhật' },
] as const;

const TIME_SLOTS = [
  'Sáng (06:00 - 08:00)',
  'Trưa (11:30 - 13:00)',
  'Chiều (17:00 - 19:00)',
  'Tối (19:30 - 21:30)',
];

export function ProfileEditForm({ initialProfile, isConfigured, fetchError }: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialProfile.display_name || '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    initialProfile.experience_level || 'beginner'
  );
  // Không tự điền ['Sàn nhà'] khi danh sách trống. Lưu đúng dữ liệu người dùng.
  const [equipment, setEquipment] = useState<string[]>(
    Array.isArray(initialProfile.available_equipment) ? initialProfile.available_equipment : []
  );
  const [customEquip, setCustomEquip] = useState('');
  const [schedule, setSchedule] = useState<ProfileScheduleDay[]>(
    Array.isArray(initialProfile.schedule_availability) ? initialProfile.schedule_availability : []
  );

  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  // Toggle thiết bị
  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const addCustomEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customEquip.trim();
    if (trimmed && !equipment.includes(trimmed)) {
      setEquipment((prev) => [...prev, trimmed]);
      setCustomEquip('');
    }
  };

  const removeEquipment = (item: string) => {
    setEquipment((prev) => prev.filter((e) => e !== item));
  };

  // Toggle ngày/giờ lịch rảnh
  const toggleDaySchedule = (dayId: ProfileScheduleDay['day_of_week'], slot: string) => {
    setSchedule((prev) => {
      const existing = prev.find((s) => s.day_of_week === dayId);
      if (!existing) {
        return [...prev, { day_of_week: dayId, available_time_slots: [slot] }];
      }
      const hasSlot = existing.available_time_slots.includes(slot);
      const updatedSlots = hasSlot
        ? existing.available_time_slots.filter((s) => s !== slot)
        : [...existing.available_time_slots, slot];

      if (updatedSlots.length === 0) {
        return prev.filter((s) => s.day_of_week !== dayId);
      }

      return prev.map((s) =>
        s.day_of_week === dayId ? { ...s, available_time_slots: updatedSlots } : s
      );
    });
  };

  // Không tải được hồ sơ thì giá trị trong form là mặc định, lưu lúc này sẽ ghi đè dữ liệu thật
  const isLocked = !isConfigured || isPending || Boolean(fetchError);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setActionResult(null);

    const formData = new FormData();
    formData.set('display_name', displayName);
    formData.set('experience_level', experienceLevel);
    // Nếu equipment rỗng, không append; action vẫn nhận mảng rỗng qua formData.getAll()
    equipment.forEach((eq) => formData.append('available_equipment', eq));
    formData.set('schedule_availability', JSON.stringify(schedule));

    startTransition(async () => {
      const res = await updateProfileAction(null, formData);
      setActionResult(res);
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-4 h-4 text-emerald-600" />
          <span>Hồ sơ cá nhân</span>
        </h2>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Không hỏi bệnh án y tế</span>
        </span>
      </div>

      {fetchError && (
        <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex items-start gap-2">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tên hiển thị */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tên hiển thị <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLocked}
            placeholder="Ví dụ: Hoàng Nam"
            maxLength={100}
            required
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 transition"
          />
          {actionResult?.errors?.display_name && (
            <p className="text-[11px] text-rose-600 mt-1">{actionResult.errors.display_name}</p>
          )}
        </div>

        {/* Kinh nghiệm */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Cấp độ kinh nghiệm Calisthenics
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[
              { id: 'beginner', label: 'Mới bắt đầu' },
              { id: 'intermediate', label: 'Trung cấp' },
              { id: 'advanced', label: 'Nâng cao' },
            ].map((lvl) => (
              <button
                type="button"
                key={lvl.id}
                disabled={isLocked}
                onClick={() => setExperienceLevel(lvl.id as ExperienceLevel)}
                className={`py-2 px-2 text-center rounded-lg text-xs font-medium border transition ${
                  experienceLevel === lvl.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dụng cụ hiện có */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dụng cụ tập luyện sẵn có</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {equipment.length > 0 ? `Đã chọn ${equipment.length}` : 'Chưa chọn dụng cụ'}
            </span>
          </label>

          {equipment.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic mb-2">
              Chưa chọn dụng cụ nào. Bạn có thể chọn các dụng cụ có sẵn bên dưới.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {COMMON_EQUIPMENT.map((item) => {
              const selected = equipment.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  disabled={isLocked}
                  onClick={() => toggleEquipment(item)}
                  className={`px-2.5 py-1 rounded-full text-xs transition border ${
                    selected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                  }`}
                >
                  {selected && '✓ '}
                  {item}
                </button>
              );
            })}
          </div>

          {/* Dụng cụ tùy chọn thêm */}
          <div className="mt-2 flex gap-1.5">
            <input
              type="text"
              value={customEquip}
              onChange={(e) => setCustomEquip(e.target.value)}
              placeholder="Thêm dụng cụ khác (VD: Dây nhảy, Parallelettes)..."
              disabled={isLocked}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={addCustomEquipment}
              disabled={isLocked || !customEquip.trim()}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium rounded-lg disabled:opacity-50"
            >
              + Thêm
            </button>
          </div>
        </div>

        {/* Lịch rảnh trong tuần */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>Khung giờ rảnh theo tuần (Tùy chọn)</span>
            </span>
          </label>

          <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 text-xs">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule.find((s) => s.day_of_week === day.id);
              const activeSlots = daySchedule?.available_time_slots || [];

              return (
                <div key={day.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 min-w-[70px] text-xs">
                    {day.name}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {TIME_SLOTS.map((slot) => {
                      const isSelected = activeSlots.includes(slot);
                      const shortSlot = slot.split(' ')[0]; // Sáng, Trưa, Chiều, Tối
                      return (
                        <button
                          type="button"
                          key={slot}
                          disabled={isLocked}
                          onClick={() => toggleDaySchedule(day.id, slot)}
                          title={slot}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {shortSlot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nút lưu */}
        <button
          type="submit"
          disabled={isLocked}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-medium text-xs sm:text-sm rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-sm"
        >
          {isPending ? (
            <span>Đang lưu thông tin hồ sơ...</span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Lưu thông tin hồ sơ</span>
            </>
          )}
        </button>
      </form>
    </section>
  );
}
