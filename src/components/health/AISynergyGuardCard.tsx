'use client';

import React from 'react';
import { ShieldCheck, AlertCircle, HeartPulse, Activity, Zap, Info } from 'lucide-react';
import {
  DailyCheckinEntity,
  HealthConditionEntity,
  BloodPressureEntity,
  ActivityEntity,
} from '@/contracts';

interface AISynergyGuardCardProps {
  todayCheckin: DailyCheckinEntity | null;
  conditions: HealthConditionEntity[];
  latestBP: BloodPressureEntity | null;
  recentActivities?: ActivityEntity[];
}

export function AISynergyGuardCard({
  todayCheckin,
  conditions,
  latestBP,
  recentActivities = [],
}: AISynergyGuardCardProps) {
  const notes: {
    type: 'warning' | 'caution' | 'info';
    title: string;
    description: string;
    icon: typeof AlertCircle;
  }[] = [];

  // 1. Kiểm tra chấn thương / tình trạng đang theo dõi do người dùng tự khai
  const activeInjuries = conditions.filter(
    (c) => (c.category === 'injury' || c.category === 'diagnosed_condition') && c.status === 'active'
  );

  activeInjuries.forEach((inj) => {
    notes.push({
      type: 'warning',
      title: `Tình trạng ghi nhận: ${inj.name}`,
      description: `Đang có bản ghi theo dõi: ${inj.name}. Người dùng nên chú ý cảm giác khớp và cơ thể khi vận động.`,
      icon: AlertCircle,
    });
  });

  // 2. Thông tin sinh hoạt nếu người dùng có ghi nhận
  const hasSleepRecorded = todayCheckin?.sleep_duration_minutes != null;
  if (hasSleepRecorded) {
    const sleepMin = todayCheckin!.sleep_duration_minutes!;
    if (sleepMin < 360) {
      notes.push({
        type: 'caution',
        title: `Thời lượng ngủ ghi nhận: ${(sleepMin / 60).toFixed(1)} giờ`,
        description: 'Người dùng đã ghi nhận thời lượng ngủ dưới 6 tiếng cho ngày hôm nay.',
        icon: Zap,
      });
    }
  }

  if (todayCheckin?.stress_level && todayCheckin.stress_level >= 4) {
    notes.push({
      type: 'info',
      title: `Mức căng thẳng tự đánh giá: ${todayCheckin.stress_level}/5`,
      description: 'Ghi nhận mức căng thẳng cao trong ngày hôm nay.',
      icon: Activity,
    });
  }

  // 3. Huyết áp gần nhất
  if (latestBP) {
    if (latestBP.systolic >= 140 || latestBP.diastolic >= 90) {
      notes.push({
        type: 'warning',
        title: `Huyết áp gần nhất: ${latestBP.systolic}/${latestBP.diastolic} mmHg`,
        description: 'Chỉ số đo tự khai ghi nhận mức huyết áp cao. Cần theo dõi thêm và tham khảo bác sĩ chuyên khoa.',
        icon: HeartPulse,
      });
    }
  }

  const hasAnyData = Boolean(todayCheckin || conditions.length > 0 || latestBP);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>Đối Chiếu Thông Tin Sức Khỏe & Vận Động</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Quy tắc cục bộ
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Tổng hợp dữ liệu bạn đã ghi nhận (Không tự chẩn đoán hay thay đổi giáo án)
            </p>
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            <p className="font-semibold">Chưa đủ dữ liệu ghi nhận hôm nay</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Bạn chưa ghi nhận sinh hoạt, huyết áp hoặc tình trạng thể chất nào cho hôm nay. Dữ liệu chưa khai được để trống, không tự động suy diễn trạng thái thể chất.
            </p>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            <p className="font-semibold">Đã ghi nhận thông tin thể chất & sinh hoạt</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hồ sơ ghi nhận dữ liệu sinh hoạt bình thường theo lời khai của bạn. Luôn lắng nghe cơ thể khi tập luyện.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notes.map((item, index) => {
            const Icon = item.icon;
            const isWarn = item.type === 'warning';
            return (
              <div
                key={index}
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  isWarn
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Icon className={`w-4 h-4 shrink-0 ${isWarn ? 'text-rose-600' : 'text-amber-600'}`} />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] opacity-90 pl-6 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400 italic text-center">
        * Quy tắc đối chiếu thông tin tự khai hỗ trợ an toàn vận động; tuyệt đối không thay thế chỉ dẫn y tế chuyên sâu.
      </p>
    </div>
  );
}
