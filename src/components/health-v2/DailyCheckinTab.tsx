'use client';

import React, { useState } from 'react';
import { Moon, Sun, BatteryCharging, Zap, AlertTriangle, Calendar, Check, Clock, Dumbbell } from 'lucide-react';
import { DailyCheckinEntity, ActivityEntity } from '@/contracts';
import { upsertDailyCheckinAction, deleteDailyCheckinAction } from '@/lib/server/health-profile-actions';
import { getLocalDateString } from '@/lib/date-utils';

interface DailyCheckinTabProps {
  dailyCheckins: DailyCheckinEntity[];
  activities: ActivityEntity[];
  timezone?: string;
  initialDate?: string;
}

export function DailyCheckinTab({ dailyCheckins, activities, timezone, initialDate }: DailyCheckinTabProps) {
  const userTz = timezone || 'Asia/Ho_Chi_Minh';
  // Mặc định ngày hôm nay theo giờ địa phương chuẩn xác (E5)
  const todayStr = getLocalDateString(new Date(), userTz);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && !Number.isNaN(Date.parse(initialDate)) ? initialDate : todayStr);

  // Tìm bản ghi của ngày đang chọn (nếu đã có)
  const existingCheckin = dailyCheckins.find((c) => c.local_date === selectedDate);

  // [S5] Form states: giữ null khi chưa có dữ liệu, KHÔNG tự ý gán số giả định
  const [sleepHours, setSleepHours] = useState<string>(
    existingCheckin?.sleep_duration_minutes != null
      ? Math.floor(existingCheckin.sleep_duration_minutes / 60).toString()
      : ''
  );
  const [sleepMins, setSleepMins] = useState<string>(
    existingCheckin?.sleep_duration_minutes != null
      ? (existingCheckin.sleep_duration_minutes % 60).toString()
      : ''
  );
  const [sleepQuality, setSleepQuality] = useState<number | null>(existingCheckin?.sleep_quality ?? null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(existingCheckin?.energy_level ?? null);
  const [stressLevel, setStressLevel] = useState<number | null>(existingCheckin?.stress_level ?? null);
  const [notes, setNotes] = useState<string>(existingCheckin?.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Khi người dùng đổi ngày, cập nhật form theo đúng dữ liệu của ngày đó hoặc giữ trống
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const checkin = dailyCheckins.find((c) => c.local_date === newDate);
    if (checkin) {
      setSleepHours(checkin.sleep_duration_minutes != null ? Math.floor(checkin.sleep_duration_minutes / 60).toString() : '');
      setSleepMins(checkin.sleep_duration_minutes != null ? (checkin.sleep_duration_minutes % 60).toString() : '');
      setSleepQuality(checkin.sleep_quality ?? null);
      setEnergyLevel(checkin.energy_level ?? null);
      setStressLevel(checkin.stress_level ?? null);
      setNotes(checkin.notes || '');
    } else {
      setSleepHours('');
      setSleepMins('');
      setSleepQuality(null);
      setEnergyLevel(null);
      setStressLevel(null);
      setNotes('');
    }
    setStatusMessage(null);
  };

  // Các hoạt động thể chất đã diễn ra trong ngày được chọn theo giờ địa phương
  const dayActivities = activities.filter((a) => {
    if (!a.start_at || a.is_planned) return false;
    const actDateStr = getLocalDateString(new Date(a.start_at), userTz);
    return actDateStr === selectedDate;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const hasH = sleepHours.trim() !== '';
    const hasM = sleepMins.trim() !== '';
    let totalMinutes: number | null = null;
    if (hasH || hasM) {
      const h = hasH ? parseInt(sleepHours, 10) : 0;
      const m = hasM ? parseInt(sleepMins, 10) : 0;
      if (!isNaN(h) && !isNaN(m)) {
        totalMinutes = h * 60 + m;
      }
    }

    const res = await upsertDailyCheckinAction({
      local_date: selectedDate,
      sleep_duration_minutes: totalMinutes,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      stress_level: stressLevel,
      notes: notes.trim() || null,
    });

    setIsSubmitting(false);
    if (!res.success) {
      setStatusMessage({ type: 'error', text: res.message || 'Lỗi khi lưu' });
    } else {
      setStatusMessage({ type: 'success', text: `Đã lưu sinh hoạt ngày ${selectedDate} thành công!` });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. KHU VỰC GHI NHẬN HẰNG NGÀY */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-600" />
              Ghi nhận sinh hoạt ngắn
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chỉ mất 30–60 giây để đánh giá giấc ngủ, năng lượng và mức căng thẳng trong ngày.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày ghi:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Thời gian ngủ */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-2">
              Thời gian ngủ đêm qua
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="w-16 text-center text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 bg-transparent"
                />
                <span className="text-xs text-slate-500">giờ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={sleepMins}
                  onChange={(e) => setSleepMins(e.target.value)}
                  className="w-16 text-center text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 bg-transparent"
                />
                <span className="text-xs text-slate-500">phút</span>
              </div>
            </div>
          </div>

          {/* Thang Chất lượng giấc ngủ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Chất lượng giấc ngủ ({sleepQuality ? `${sleepQuality}/5` : 'Chưa đánh giá'})
              </label>
              <span className="text-xs text-indigo-600 font-medium">
                {sleepQuality === null && 'Chưa đánh giá (tùy chọn)'}
                {sleepQuality === 1 && '1 - Rất kém / chập chờn / khó ngủ'}
                {sleepQuality === 2 && '2 - Kém / thức giấc giữa chừng'}
                {sleepQuality === 3 && '3 - Tạm ổn / bình thường'}
                {sleepQuality === 4 && '4 - Ngon giấc / dễ chịu'}
                {sleepQuality === 5 && '5 - Cực kỳ sâu & sảng khoái'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setSleepQuality((prev) => (prev === lvl ? null : lvl))}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    sleepQuality === lvl
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Thang Mức năng lượng */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Mức năng lượng trong ngày ({energyLevel ? `${energyLevel}/5` : 'Chưa đánh giá'})
              </label>
              <span className="text-xs text-emerald-600 font-medium">
                {energyLevel === null && 'Chưa đánh giá (tùy chọn)'}
                {energyLevel === 1 && '1 - Kiệt sức / mệt rã rời'}
                {energyLevel === 2 && '2 - Hơi uể oải / thiếu sức'}
                {energyLevel === 3 && '3 - Bình thường'}
                {energyLevel === 4 && '4 - Năng động / tỉnh táo'}
                {energyLevel === 5 && '5 - Tràn đầy sinh lực / sung sức'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setEnergyLevel((prev) => (prev === lvl ? null : lvl))}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    energyLevel === lvl
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Thang Mức căng thẳng */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Mức căng thẳng / áp lực ({stressLevel ? `${stressLevel}/5` : 'Chưa đánh giá'})
              </label>
              <span className="text-xs text-amber-600 font-medium">
                {stressLevel === null && 'Chưa đánh giá (tùy chọn)'}
                {stressLevel === 1 && '1 - Rất thoải mái / thư thái'}
                {stressLevel === 2 && '2 - Căng thẳng nhẹ'}
                {stressLevel === 3 && '3 - Trung bình / kiểm soát được'}
                {stressLevel === 4 && '4 - Khá căng thẳng / bồn chồn'}
                {stressLevel === 5 && '5 - Áp lực cao độ / quá tải'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setStressLevel((prev) => (prev === lvl ? null : lvl))}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    stressLevel === lvl
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Tự động liên kết hoạt động tập luyện trong ngày */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-indigo-500" />
              Hoạt động vận động trong ngày ({selectedDate}):
            </span>
            {dayActivities.length > 0 ? (
              <div className="space-y-1">
                {dayActivities.map((act) => (
                  <div key={act.id} className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      • <strong className="capitalize">{act.activity_type}</strong> ({act.duration_minutes} phút)
                    </span>
                    <span className="text-slate-400">
                      Mức mệt: {act.fatigue_level ? `${act.fatigue_level}/10` : 'chưa ghi'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Chưa có buổi tập nào trong ngày này (không bắt buộc nhập lại).
              </p>
            )}
          </div>

          {/* Ghi chú trong ngày */}
          <div>
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
              Ghi chú sinh hoạt hôm nay
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Uống đủ 2L nước, đi dạo buổi tối, hơi đau vai..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu nhật ký...' : `Lưu sinh hoạt ngày ${selectedDate}`}
          </button>
        </form>
      </div>

      {/* 2. LỊCH SỬ GHI NHẬN CÁC NGÀY TRƯỚC */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Nhật ký các ngày đã ghi ({dailyCheckins.length})
        </h3>

        {dailyCheckins.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dailyCheckins.map((item) => (
              <div
                key={item.id}
                onClick={() => handleDateChange(item.local_date)}
                className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Ngày {item.local_date}
                  </span>
                  <div className="text-slate-500 text-[11px] mt-0.5 flex gap-2">
                    {item.sleep_duration_minutes ? (
                      <span>Ngủ: {Math.floor(item.sleep_duration_minutes / 60)}h{item.sleep_duration_minutes % 60}m</span>
                    ) : null}
                    {item.energy_level ? <span>NL: {item.energy_level}/5</span> : null}
                    {item.stress_level ? <span>Stress: {item.stress_level}/5</span> : null}
                  </div>
                </div>

                <span className="text-indigo-600 text-xs font-medium hover:underline">
                  Sửa / Xem
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-4">
            Chưa có ngày nào được ghi nhận sinh hoạt.
          </p>
        )}
      </div>
    </div>
  );
}
