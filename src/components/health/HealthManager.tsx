'use client';

import React from 'react';
import {
  HealthProfileEntity,
  DailyCheckinEntity,
  BloodPressureEntity,
  HealthConditionEntity,
  MedicationEntity,
  AllergyEntity,
  HealthEventEntity,
  ActivityEntity,
} from '@/contracts';
import { HealthProfileHeader } from './HealthProfileHeader';
import { QuickCheckinWidget } from './QuickCheckinWidget';
import { AISynergyGuardCard } from './AISynergyGuardCard';
import { BloodPressureSection } from './BloodPressureSection';
import { HealthConditionsSection } from './HealthConditionsSection';
import { MedicationsSection } from './MedicationsSection';
import { HealthTimelineSection } from './HealthTimelineSection';

interface HealthManagerProps {
  healthProfile: HealthProfileEntity | null;
  todayCheckin: DailyCheckinEntity | null;
  todayDateStr: string;
  recentCheckins: DailyCheckinEntity[];
  bloodPressures: BloodPressureEntity[];
  conditions: HealthConditionEntity[];
  medications: MedicationEntity[];
  allergies: AllergyEntity[];
  events: HealthEventEntity[];
  recentActivities: ActivityEntity[];
  displayName: string;
  isConfigured: boolean;
  errors?: string[];
}

export function HealthManager({
  healthProfile,
  todayCheckin,
  todayDateStr,
  recentCheckins,
  bloodPressures,
  conditions,
  medications,
  allergies,
  events,
  recentActivities,
  displayName,
  isConfigured,
  errors = [],
}: HealthManagerProps) {
  const latestBP = bloodPressures.length > 0 ? bloodPressures[0] : null;

  return (
    <div className="space-y-5 pb-10">
      {/* Cảnh báo lỗi tải dữ liệu (E3) */}
      {errors.length > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold">Đã xảy ra lỗi khi tải một số dữ liệu sức khỏe:</span>
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
            >
              Tải lại
            </button>
          </div>
          <ul className="list-disc list-inside text-[11px] opacity-90">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. Header Hồ sơ nền (Năm sinh, bối cảnh nghề nghiệp) */}
      <HealthProfileHeader
        healthProfile={healthProfile}
        displayName={displayName}
        isConfigured={isConfigured}
      />

      {/* 2. Micro-interaction 10 giây: Check-in sinh hoạt hôm nay */}
      <QuickCheckinWidget
        todayCheckin={todayCheckin}
        todayDateStr={todayDateStr}
        isConfigured={isConfigured}
      />

      {/* 3. AI Synergy Health Guard: Trí tuệ nhân tạo đối chiếu Sức Khỏe & Vận Động */}
      <AISynergyGuardCard
        todayCheckin={todayCheckin}
        conditions={conditions}
        latestBP={latestBP}
        recentActivities={recentActivities}
      />

      {/* 4. Đo Huyết áp (Tâm thu / Tâm trương) */}
      <BloodPressureSection
        readings={bloodPressures}
        isConfigured={isConfigured}
      />

      {/* 5. Tình trạng sức khỏe, Chấn thương & Triệu chứng */}
      <HealthConditionsSection
        conditions={conditions}
        isConfigured={isConfigured}
      />

      {/* 6. Thuốc đang dùng & Cảnh báo Dị ứng */}
      <MedicationsSection
        medications={medications}
        allergies={allergies}
        isConfigured={isConfigured}
      />

      {/* 7. Dòng thời gian khám bệnh & Xét nghiệm */}
      <HealthTimelineSection
        events={events}
        isConfigured={isConfigured}
      />
    </div>
  );
}
