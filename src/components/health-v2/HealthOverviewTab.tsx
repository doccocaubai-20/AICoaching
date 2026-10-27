'use client';

import React, { useState } from 'react';
import {
  User,
  HeartPulse,
  Moon,
  Stethoscope,
  Pill,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  PlusCircle,
  FileText,
  Filter,
} from 'lucide-react';
import {
  HealthProfileEntity,
  ObservationEntity,
  BloodPressureEntity,
  DailyCheckinEntity,
  HealthConditionEntity,
  AllergyEntity,
  MedicationEntity,
  HealthEventEntity,
  HealthDocumentEntity,
  ActivityEntity,
  GoalEntity,
  computeCheckinWeeklyStats,
} from '@/contracts';
import { updateHealthProfileBackgroundAction } from '@/lib/server/health-profile-actions';
import { getLocalDateString, getPastLocalDateString } from '@/lib/date-utils';

interface HealthOverviewTabProps {
  healthProfile: HealthProfileEntity | null;
  healthProfileError?: string | null;
  observations: ObservationEntity[];
  bloodPressures: BloodPressureEntity[];
  dailyCheckins: DailyCheckinEntity[];
  conditions: HealthConditionEntity[];
  allergies: AllergyEntity[];
  medications: MedicationEntity[];
  healthEvents: HealthEventEntity[];
  documents: HealthDocumentEntity[];
  activities: ActivityEntity[];
  goals: GoalEntity[];
  onNavigateTab: (tabKey: string) => void;
}

export function HealthOverviewTab({
  healthProfile,
  healthProfileError,
  observations,
  bloodPressures,
  dailyCheckins,
  conditions,
  allergies,
  medications,
  healthEvents,
  documents,
  activities,
  goals,
  onNavigateTab,
}: HealthOverviewTabProps) {
  // Modal sửa thông tin nền
  const [showBgModal, setShowBgModal] = useState(false);
  const [birthYear, setBirthYear] = useState<string>(healthProfile?.birth_year?.toString() || '');
  const [workContext, setWorkContext] = useState<string>(healthProfile?.work_context || '');
  const [timezone, setTimezone] = useState<string>(healthProfile?.timezone || 'Asia/Ho_Chi_Minh');
  const [bgNotes, setBgNotes] = useState<string>(healthProfile?.notes || '');
  const [isSubmittingBg, setIsSubmittingBg] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);

  // Bộ lọc Timeline
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'vitals' | 'checkin' | 'medical' | 'event'>('all');

  // Xử lý lưu hồ sơ nền
  const handleSaveBackground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (healthProfileError) {
      setBgError('Không thể lưu hồ sơ nền khi chưa tải được dữ liệu gốc từ máy chủ.');
      return;
    }
    setIsSubmittingBg(true);
    setBgError(null);

    const res = await updateHealthProfileBackgroundAction({
      birth_year: birthYear ? parseInt(birthYear, 10) : null,
      work_context: (workContext as any) || null,
      timezone: timezone.trim() || 'Asia/Ho_Chi_Minh',
      notes: bgNotes.trim() || null,
    });

    setIsSubmittingBg(false);
    if (!res.success) {
      setBgError(res.message || 'Lỗi lưu thông tin');
    } else {
      setShowBgModal(false);
    }
  };

  // Trích xuất các chỉ số mới nhất
  const latestWeight = observations.find((o) => o.metric_type === 'weight');
  const latestHeight = observations.find((o) => o.metric_type === 'height');
  const latestWaist = observations.find((o) => o.metric_type === 'waist_circumference');
  const latestHeartRate = observations.find((o) => o.metric_type === 'resting_heart_rate');
  const latestBP = bloodPressures.length > 0 ? bloodPressures[0] : null;

  // [E4, E5] Thống kê sinh hoạt đúng cửa sổ 7 ngày gần nhất theo múi giờ hồ sơ
  const userTz = healthProfile?.timezone || 'Asia/Ho_Chi_Minh';
  const todayStr = getLocalDateString(new Date(), userTz);
  const past6DaysStr = getPastLocalDateString(6, new Date(), userTz);

  const weekCheckins = dailyCheckins.filter(
    (c) => c.local_date && c.local_date >= past6DaysStr && c.local_date <= todayStr
  );
  const checkinStats = computeCheckinWeeklyStats(weekCheckins, 7);

  // Tình trạng & thuốc đang hoạt động
  const activeConditions = conditions.filter((c) => c.status === 'active' || c.status === 'monitoring');
  const activeMedications = medications.filter((m) => m.status === 'active');
  const knownAllergies = allergies.filter((a) => a.status === 'known');

  // Tổng hợp dòng thời gian (Unified Timeline)
  type TimelineItem = {
    id: string;
    type: 'vitals' | 'checkin' | 'medical' | 'event';
    title: string;
    subtitle: string;
    date: string;
    source: string;
  };

  const timelineItems: TimelineItem[] = [];

  observations.slice(0, 5).forEach((o) => {
    const typeLabel =
      o.metric_type === 'weight' ? 'Cân nặng' :
      o.metric_type === 'height' ? 'Chiều cao' :
      o.metric_type === 'waist_circumference' ? 'Vòng eo' :
      o.metric_type === 'resting_heart_rate' ? 'Nhịp tim nghỉ' : 'Chỉ số';
    timelineItems.push({
      id: `obs-${o.id}`,
      type: 'vitals',
      title: `${typeLabel}: ${o.metric_value} ${o.metric_unit}`,
      subtitle: o.notes || 'Đo tự khai',
      date: o.observed_at,
      source: o.source === 'self_reported' ? 'Tự khai' : 'Nhập tay',
    });
  });

  bloodPressures.slice(0, 3).forEach((bp) => {
    timelineItems.push({
      id: `bp-${bp.id}`,
      type: 'vitals',
      title: `Huyết áp: ${bp.systolic}/${bp.diastolic} mmHg`,
      subtitle: bp.notes || 'Đo huyết áp',
      date: bp.measured_at,
      source: bp.source === 'self_reported' ? 'Tự khai' : 'Nhập tay',
    });
  });

  dailyCheckins.slice(0, 5).forEach((dc) => {
    timelineItems.push({
      id: `checkin-${dc.id}`,
      type: 'checkin',
      title: `Sinh hoạt ngày ${dc.local_date}`,
      subtitle: `${dc.sleep_duration_minutes ? `Ngủ ${Math.floor(dc.sleep_duration_minutes / 60)}h${dc.sleep_duration_minutes % 60}m` : 'Chưa ghi giờ ngủ'}${dc.energy_level ? ` • Năng lượng ${dc.energy_level}/5` : ''}`,
      date: dc.local_date,
      source: 'Nhật ký sinh hoạt',
    });
  });

  healthEvents.slice(0, 4).forEach((ev) => {
    const typeNames: Record<string, string> = {
      checkup: 'Khám bệnh',
      lab_test: 'Xét nghiệm',
      vaccination: 'Tiêm chủng',
      other: 'Sự kiện y tế',
    };
    timelineItems.push({
      id: `event-${ev.id}`,
      type: 'event',
      title: `${typeNames[ev.event_type] || 'Sự kiện y tế'}: ${ev.facility_name || 'Cơ sở y tế'}`,
      subtitle: ev.notes || 'Không có ghi chú thêm',
      date: ev.event_date,
      source: 'Hồ sơ khám',
    });
  });

  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTimeline = timelineFilter === 'all'
    ? timelineItems
    : timelineItems.filter((item) => item.type === timelineFilter);

  return (
    <div className="space-y-6">
      {/* 1. THÔNG TIN NỀN (BACKGROUND INFO) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Thông tin nền sức khỏe</h2>
          </div>
          <button
            onClick={() => !healthProfileError && setShowBgModal(true)}
            disabled={Boolean(healthProfileError)}
            className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Chỉnh sửa
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">Năm sinh</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {healthProfile?.birth_year || 'Chưa khai'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">Bối cảnh công việc</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {healthProfile?.work_context === 'sedentary' ? 'Chủ yếu ngồi' :
               healthProfile?.work_context === 'standing_walking' ? 'Đứng / Đi lại nhiều' :
               healthProfile?.work_context === 'physical_labor' ? 'Lao động thể lực' :
               healthProfile?.work_context === 'other' ? 'Khác' : 'Chưa khai'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 block">Múi giờ</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
              {healthProfile?.timezone || 'Asia/Ho_Chi_Minh'}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
          <span>* Chiều cao được lưu và lấy trực tiếp từ lịch sử số đo</span>
          <span>Cập nhật: {healthProfile?.updated_at ? new Date(healthProfile.updated_at).toLocaleDateString('vi-VN') : 'Mới'}</span>
        </div>
      </div>

      {/* 2. CHỈ SỐ MỚI NHẤT (LATEST VITALS) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Chỉ số thể chất mới nhất</h2>
          </div>
          <button
            onClick={() => onNavigateTab('vitals')}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium"
          >
            Lịch sử & biểu đồ <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Cân nặng</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {latestWeight ? latestWeight.metric_value : '--'}
              </span>
              <span className="text-xs text-slate-500">kg</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
              {latestWeight ? new Date(latestWeight.observed_at).toLocaleDateString('vi-VN') : 'Chưa có'}
            </span>
          </div>

          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Huyết áp</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : '--/--'}
              </span>
              <span className="text-xs text-slate-500">mmHg</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
              {latestBP ? new Date(latestBP.measured_at).toLocaleDateString('vi-VN') : 'Chưa có'}
            </span>
          </div>

          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Chiều cao</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {latestHeight ? latestHeight.metric_value : '--'}
              </span>
              <span className="text-xs text-slate-500">cm</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
              {latestHeight ? new Date(latestHeight.observed_at).toLocaleDateString('vi-VN') : 'Chưa có'}
            </span>
          </div>

          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Vòng eo</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {latestWaist ? latestWaist.metric_value : '--'}
              </span>
              <span className="text-xs text-slate-500">cm</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">
              {latestWaist ? new Date(latestWaist.observed_at).toLocaleDateString('vi-VN') : 'Chưa có'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TÓM TẮT SINH HOẠT 7 NGÀY (DAILY CHECK-IN SUMMARY) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sinh hoạt & giấc ngủ 7 ngày qua</h2>
          </div>
          <button
            onClick={() => onNavigateTab('checkin')}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
          >
            Nhật ký sinh hoạt <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {checkinStats.summaryText}
          </p>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-center">
            <div>
              <span className="text-xs text-slate-500 block">Số ngày đã ghi</span>
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {checkinStats.totalRecordedDays}/7
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Năng lượng TB</span>
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {checkinStats.averageEnergy !== null ? `${checkinStats.averageEnergy}/5` : '--'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Căng thẳng TB</span>
              <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {checkinStats.averageStress !== null ? `${checkinStats.averageStress}/5` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TÌNH TRẠNG, DỊ ỨNG & THUỐC (MEDICAL & MEDICATIONS) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Tình trạng theo dõi & Thuốc</h2>
          </div>
          <button
            onClick={() => onNavigateTab('medical')}
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
          >
            Quản lý <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Tình trạng */}
          <div className="text-xs">
            <span className="text-slate-500 block mb-1 font-medium">Tình trạng sức khỏe & Chấn thương:</span>
            {activeConditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeConditions.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                  >
                    {c.name}
                    <span className="text-[10px] ml-1 opacity-75">
                      ({c.category === 'diagnosed_condition' ? 'Bệnh khai' : c.category === 'injury' ? 'Chấn thương' : 'Triệu chứng'})
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa ghi nhận tình trạng nào cần theo dõi.</p>
            )}
          </div>

          {/* Dị ứng */}
          <div className="text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block mb-1 font-medium">Dị ứng tự khai:</span>
            {knownAllergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {knownAllergies.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                  >
                    {a.allergen} {a.reaction ? `(${a.reaction})` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa ghi nhận dị ứng (trạng thái: chưa khai/chưa biết).</p>
            )}
          </div>

          {/* Thuốc */}
          <div className="text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block mb-1 font-medium">Thuốc đang sử dụng:</span>
            {activeMedications.length > 0 ? (
              <div className="space-y-1">
                {activeMedications.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-medium">• {m.name}</span>
                    <span className="text-slate-400">{m.dosage_instructions || 'Tự dùng'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Không có thuốc đang sử dụng.</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. DÒNG THỜI GIAN KẾT HỢP (UNIFIED TIMELINE) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Dòng thời gian sự kiện sức khỏe</h2>
          </div>

          {/* Bộ lọc loại */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
            {(['all', 'vitals', 'checkin', 'event'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setTimelineFilter(filterKey)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  timelineFilter === filterKey
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {filterKey === 'all' ? 'Tất cả' :
                 filterKey === 'vitals' ? 'Chỉ số' :
                 filterKey === 'checkin' ? 'Sinh hoạt' : 'Khám/Xét nghiệm'}
              </button>
            ))}
          </div>
        </div>

        {filteredTimeline.length > 0 ? (
          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4 py-2">
            {filteredTimeline.slice(0, 8).map((item) => (
              <div key={item.id} className="relative pl-5 text-xs">
                <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                  <span className="text-slate-400">{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                </div>
                <p className="text-slate-500 mt-0.5">{item.subtitle}</p>
                <span className="text-[10px] text-slate-400 mt-0.5 inline-block bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {item.source}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            Chưa có sự kiện nào theo bộ lọc này.
          </div>
        )}
      </div>

      {/* MODAL SỬA THÔNG TIN NỀN */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
              Cập nhật thông tin nền sức khỏe
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Các thông tin này hoàn toàn tùy chọn. Bạn có thể bỏ qua bất kỳ mục nào chưa muốn chia sẻ.
            </p>

            <form onSubmit={handleSaveBackground} className="space-y-4">
              {bgError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs">
                  {bgError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Năm sinh
                </label>
                <input
                  type="number"
                  placeholder="Ví dụ: 1995"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Bối cảnh công việc
                </label>
                <select
                  value={workContext}
                  onChange={(e) => setWorkContext(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Chưa khai / Bỏ qua --</option>
                  <option value="sedentary">Chủ yếu ngồi (Văn phòng, IT, bàn giấy)</option>
                  <option value="standing_walking">Đứng hoặc đi lại nhiều (Bán hàng, phục vụ)</option>
                  <option value="physical_labor">Lao động thể lực (Khuân vác, xây dựng, thể thao)</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Múi giờ sinh hoạt
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Ho_Chi_Minh"
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Ghi chú nền tùy chọn
                </label>
                <textarea
                  value={bgNotes}
                  onChange={(e) => setBgNotes(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú về lối sống, thói quen sinh hoạt..."
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBgModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBg}
                  className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {isSubmittingBg ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
