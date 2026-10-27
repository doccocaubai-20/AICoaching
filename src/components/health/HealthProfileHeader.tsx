'use client';

import React, { useState, useTransition } from 'react';
import { UserCheck, Briefcase, Clock, Calendar, Edit3, X, Check } from 'lucide-react';
import { HealthProfileEntity, WorkContext } from '@/contracts';
import { updateHealthProfileBackgroundAction } from '@/lib/server/health-profile-actions';

interface HealthProfileHeaderProps {
  healthProfile: HealthProfileEntity | null;
  displayName: string;
  isConfigured: boolean;
}

const WORK_CONTEXT_LABELS: Record<WorkContext, string> = {
  sedentary: 'Chủ yếu ngồi (Văn phòng, IT)',
  standing_walking: 'Thường xuyên đứng / đi lại',
  physical_labor: 'Lao động thể lực nặng',
  other: 'Khác',
};

export function HealthProfileHeader({
  healthProfile,
  displayName,
  isConfigured,
}: HealthProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [birthYear, setBirthYear] = useState<string>(
    healthProfile?.birth_year ? String(healthProfile.birth_year) : ''
  );
  const [workContext, setWorkContext] = useState<WorkContext | ''>(
    healthProfile?.work_context || 'sedentary'
  );
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const yearNum = birthYear ? parseInt(birthYear, 10) : null;

    startTransition(async () => {
      const res = await updateHealthProfileBackgroundAction({
        birth_year: yearNum,
        work_context: workContext ? (workContext as WorkContext) : null,
      });

      if (res.success) {
        setIsEditing(false);
        setMsg('Đã cập nhật thông tin nền!');
      } else {
        setMsg(res.message || 'Lỗi cập nhật.');
      }
    });
  };

  const currentYear = new Date().getFullYear();
  const age = healthProfile?.birth_year ? currentYear - healthProfile.birth_year : null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-lg space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[11px] font-semibold mb-2">
            <span>Hồ Sơ Sức Khỏe Cá Nhân V2</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {displayName}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Theo dõi sức khỏe nền tảng & an toàn rèn luyện thể chất
          </p>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition text-xs flex items-center gap-1"
        >
          {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          <span>{isEditing ? 'Đóng' : 'Sửa'}</span>
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white/10 backdrop-blur rounded-2xl p-4 space-y-3 text-xs border border-white/15">
          {msg && <div className="p-2 bg-indigo-500/40 rounded-xl text-center">{msg}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-slate-200">Năm sinh:</label>
              <input
                type="number"
                min="1920"
                max={currentYear}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="Ví dụ: 1998"
                className="w-full px-3 py-1.5 bg-black/30 border border-white/20 rounded-xl text-white font-bold"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-slate-200">Đặc thù công việc:</label>
              <select
                value={workContext}
                onChange={(e) => setWorkContext(e.target.value as WorkContext)}
                className="w-full px-3 py-1.5 bg-black/30 border border-white/20 rounded-xl text-white text-[11px]"
              >
                <option value="sedentary">Chủ yếu ngồi (Văn phòng, IT)</option>
                <option value="standing_walking">Đứng / Đi lại nhiều</option>
                <option value="physical_labor">Lao động thể lực nặng</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="py-2 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isPending ? 'Đang lưu...' : 'Lưu thông tin nền'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span>Tuổi / Năm sinh</span>
            </span>
            <p className="font-extrabold text-sm mt-0.5">
              {age ? `${age} tuổi (${healthProfile?.birth_year})` : 'Chưa khai'}
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
              <Briefcase className="w-3 h-3 text-amber-400" />
              <span>Bối cảnh sinh hoạt</span>
            </span>
            <p className="font-extrabold text-sm mt-0.5 truncate">
              {healthProfile?.work_context ? WORK_CONTEXT_LABELS[healthProfile.work_context] : 'Chưa khai'}
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-2.5 border border-white/10">
            <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-teal-400" />
              <span>Múi giờ</span>
            </span>
            <p className="font-extrabold text-sm mt-0.5 truncate">
              {healthProfile?.timezone || 'Asia/Ho_Chi_Minh'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
