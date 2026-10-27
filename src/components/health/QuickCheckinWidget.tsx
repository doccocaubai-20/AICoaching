'use client';

import React, { useState, useTransition } from 'react';
import { Moon, Zap, Activity, Check, Sparkles, Edit3 } from 'lucide-react';
import { DailyCheckinEntity } from '@/contracts';
import { upsertDailyCheckinAction } from '@/lib/server/health-profile-actions';

interface QuickCheckinWidgetProps {
  todayCheckin: DailyCheckinEntity | null;
  todayDateStr: string; // YYYY-MM-DD
  isConfigured: boolean;
}

const SLEEP_EMOJIS = [
  { val: 1, icon: '😴', label: 'Rất mệt' },
  { val: 2, icon: '🥱', label: 'Uể oải' },
  { val: 3, icon: '😐', label: 'Tạm ổn' },
  { val: 4, icon: '😊', label: 'Ngon giấc' },
  { val: 5, icon: '🤩', label: 'Sảng khoái' },
];

const ENERGY_EMOJIS = [
  { val: 1, icon: '🪫', label: 'Kiệt sức' },
  { val: 2, icon: '🔋', label: 'Hơi thấp' },
  { val: 3, icon: '⚡', label: 'Bình thường' },
  { val: 4, icon: '🚀', label: 'Khỏe khoắn' },
  { val: 5, icon: '🔥', label: 'Đỉnh cao' },
];

const STRESS_EMOJIS = [
  { val: 1, icon: '😌', label: 'Thoải mái' },
  { val: 2, icon: '🙂', label: 'Nhẹ nhàng' },
  { val: 3, icon: '😐', label: 'Bình thường' },
  { val: 4, icon: '😰', label: 'Căng thẳng' },
  { val: 5, icon: '🤯', label: 'Quá tải' },
];

export function QuickCheckinWidget({
  todayCheckin,
  todayDateStr,
  isConfigured,
}: QuickCheckinWidgetProps) {
  const [isEditing, setIsEditing] = useState(!todayCheckin);
  const [sleepHours, setSleepHours] = useState<number>(
    todayCheckin?.sleep_duration_minutes
      ? Math.round((todayCheckin.sleep_duration_minutes / 60) * 10) / 10
      : 7.5
  );
  const [sleepQuality, setSleepQuality] = useState<number>(
    todayCheckin?.sleep_quality || 4
  );
  const [energyLevel, setEnergyLevel] = useState<number>(
    todayCheckin?.energy_level || 3
  );
  const [stressLevel, setStressLevel] = useState<number>(
    todayCheckin?.stress_level || 2
  );
  const [notes, setNotes] = useState<string>(todayCheckin?.notes || '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!isConfigured) {
      setStatusMessage('Hệ thống đang ở chế độ xem thử (chưa kết nối DB).');
      return;
    }

    startTransition(async () => {
      setStatusMessage(null);
      const res = await upsertDailyCheckinAction({
        local_date: todayDateStr,
        sleep_duration_minutes: Math.round(sleepHours * 60),
        sleep_quality: sleepQuality,
        energy_level: energyLevel,
        stress_level: stressLevel,
        notes: notes.trim() || null,
      });

      if (res.success) {
        setIsEditing(false);
        setStatusMessage('Đã ghi nhận sinh hoạt hôm nay!');
      } else {
        setStatusMessage(res.message || 'Lỗi lưu sinh hoạt.');
      }
    });
  };

  // 1. Trạng thái đã check-in và không trong chế độ sửa
  if (todayCheckin && !isEditing) {
    const sleepQ = SLEEP_EMOJIS.find((e) => e.val === todayCheckin.sleep_quality);
    const energy = ENERGY_EMOJIS.find((e) => e.val === todayCheckin.energy_level);
    const stress = STRESS_EMOJIS.find((e) => e.val === todayCheckin.stress_level);
    const sleepH = todayCheckin.sleep_duration_minutes
      ? `${(todayCheckin.sleep_duration_minutes / 60).toFixed(1)}h`
      : '—';

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-sm shadow-sm">
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                <span>Đã Check-in Sinh Hoạt Hôm Nay</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium">
                  {todayDateStr}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Dữ liệu sẵn sàng để AI đối chiếu an toàn vận động
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition"
            title="Chỉnh sửa lại"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Moon className="w-3 h-3 text-indigo-500" />
              <span>Giấc ngủ</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {sleepH} {sleepQ?.icon}
            </p>
            <p className="text-[10px] text-slate-400">{sleepQ?.label || 'Chưa ghi'}</p>
          </div>

          <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Năng lượng</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {energy?.icon} {todayCheckin.energy_level ? `${todayCheckin.energy_level}/5` : '—'}
            </p>
            <p className="text-[10px] text-slate-400">{energy?.label || 'Chưa ghi'}</p>
          </div>

          <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
            <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Activity className="w-3 h-3 text-emerald-500" />
              <span>Căng thẳng</span>
            </div>
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {stress?.icon} {todayCheckin.stress_level ? `${todayCheckin.stress_level}/5` : '—'}
            </p>
            <p className="text-[10px] text-slate-400">{stress?.label || 'Chưa ghi'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Chế độ Form Check-in nhanh 10 giây (Micro-interaction)
  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white rounded-3xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">
              Check-in Sinh Hoạt Nhanh (10 giây)
            </h3>
            <p className="text-[11px] text-indigo-200">
              Ngủ ngon không? Năng lượng thế nào? {todayDateStr}
            </p>
          </div>
        </div>

        {todayCheckin && (
          <button
            onClick={() => setIsEditing(false)}
            className="text-[11px] text-indigo-200 hover:text-white underline underline-offset-2"
          >
            Hủy
          </button>
        )}
      </div>

      {/* Thanh trượt Thời lượng ngủ */}
      <div className="space-y-1.5 bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/15">
        <div className="flex justify-between items-center text-xs">
          <span className="flex items-center gap-1 font-medium text-indigo-100">
            <Moon className="w-3.5 h-3.5 text-indigo-300" />
            <span>Thời lượng ngủ:</span>
          </span>
          <span className="font-extrabold text-amber-300 text-sm">
            {sleepHours} tiếng
          </span>
        </div>
        <input
          type="range"
          min="4"
          max="12"
          step="0.5"
          value={sleepHours}
          onChange={(e) => setSleepHours(parseFloat(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
        />
        <div className="flex justify-between text-[10px] text-indigo-300">
          <span>4h (Thiếu ngủ)</span>
          <span>7 - 8h (Tối ưu)</span>
          <span>12h</span>
        </div>
      </div>

      {/* 3 Khối Emoji tương tác nhanh */}
      <div className="space-y-2.5 text-xs">
        {/* Chất lượng ngủ */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-indigo-100 flex items-center justify-between">
            <span>Chất lượng giấc ngủ:</span>
            <span className="text-amber-300 font-bold">
              {SLEEP_EMOJIS.find((e) => e.val === sleepQuality)?.label}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SLEEP_EMOJIS.map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setSleepQuality(item.val)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
                  sleepQuality === item.val
                    ? 'bg-white text-indigo-950 font-bold shadow-md scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-indigo-100'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] truncate max-w-full">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mức năng lượng */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-indigo-100 flex items-center justify-between">
            <span>Mức năng lượng cơ thể:</span>
            <span className="text-amber-300 font-bold">
              {ENERGY_EMOJIS.find((e) => e.val === energyLevel)?.label}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {ENERGY_EMOJIS.map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setEnergyLevel(item.val)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
                  energyLevel === item.val
                    ? 'bg-white text-indigo-950 font-bold shadow-md scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-indigo-100'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] truncate max-w-full">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mức căng thẳng */}
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-indigo-100 flex items-center justify-between">
            <span>Mức căng thẳng (Stress):</span>
            <span className="text-amber-300 font-bold">
              {STRESS_EMOJIS.find((e) => e.val === stressLevel)?.label}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STRESS_EMOJIS.map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setStressLevel(item.val)}
                className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
                  stressLevel === item.val
                    ? 'bg-white text-indigo-950 font-bold shadow-md scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-indigo-100'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-[9px] truncate max-w-full">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-2.5 rounded-xl bg-white/20 text-center text-xs font-medium">
          {statusMessage}
        </div>
      )}

      {/* Nút lưu 1 chạm */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        <span>{isPending ? 'Đang lưu nhanh...' : 'Lưu Sinh Hoạt Ngay ✨'}</span>
      </button>
    </div>
  );
}
