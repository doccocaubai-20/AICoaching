'use client';

import React, { useState } from 'react';
import {
  Activity,
  HeartPulse,
  Moon,
  Stethoscope,
  FileText,
  Dumbbell,
  ShieldCheck,
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
  ProfileScheduleDay,
  ExperienceLevel,
} from '@/contracts';

import { HealthOverviewTab } from './HealthOverviewTab';
import { VitalsTab } from './VitalsTab';
import { DailyCheckinTab } from './DailyCheckinTab';
import { MedicalTab } from './MedicalTab';
import { EventsAndDocumentsTab } from './EventsAndDocumentsTab';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { GoalsManager } from '@/components/profile/GoalsManager';

export interface HealthProfileContainerProps {
  userDisplayName: string;
  userExperienceLevel: ExperienceLevel;
  userEquipment: string[];
  userSchedule: ProfileScheduleDay[];
  profileError: string | null;
  goals: GoalEntity[];
  goalsError: string | null;
  healthProfile: HealthProfileEntity | null;
  observations: ObservationEntity[];
  bloodPressures: BloodPressureEntity[];
  dailyCheckins: DailyCheckinEntity[];
  conditions: HealthConditionEntity[];
  allergies: AllergyEntity[];
  medications: MedicationEntity[];
  healthEvents: HealthEventEntity[];
  documents: HealthDocumentEntity[];
  activities: ActivityEntity[];
  isConfigured: boolean;
  healthProfileError?: string | null;
  observationsError?: string | null;
  bloodPressuresError?: string | null;
  dailyCheckinsError?: string | null;
  conditionsError?: string | null;
  allergiesError?: string | null;
  medicationsError?: string | null;
  healthEventsError?: string | null;
  documentsError?: string | null;
  activitiesError?: string | null;
}

export function HealthProfileContainer({
  userDisplayName,
  userExperienceLevel,
  userEquipment,
  userSchedule,
  profileError,
  goals,
  goalsError,
  healthProfile,
  observations,
  bloodPressures,
  dailyCheckins,
  conditions,
  allergies,
  medications,
  healthEvents,
  documents,
  activities,
  isConfigured,
  healthProfileError,
  observationsError,
  bloodPressuresError,
  dailyCheckinsError,
  conditionsError,
  allergiesError,
  medicationsError,
  healthEventsError,
  documentsError,
  activitiesError,
}: HealthProfileContainerProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');

  const errorList = [
    profileError,
    goalsError,
    healthProfileError,
    observationsError,
    bloodPressuresError,
    dailyCheckinsError,
    conditionsError,
    allergiesError,
    medicationsError,
    healthEventsError,
    documentsError,
    activitiesError,
  ].filter(Boolean) as string[];

  const hasAnyErrors = errorList.length > 0;

  const tabs = [
    { key: 'overview', label: 'Tổng quan', icon: Activity },
    { key: 'vitals', label: 'Chỉ số & Thể chất', icon: HeartPulse },
    { key: 'checkin', label: 'Sinh hoạt & Giấc ngủ', icon: Moon },
    { key: 'medical', label: 'Y tế & Thuốc', icon: Stethoscope },
    { key: 'events_docs', label: 'Khám & Tài liệu', icon: FileText },
    { key: 'training', label: 'Luyện tập', icon: Dumbbell },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Tiêu đề trang Hồ sơ Sức khỏe V2 */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Hồ sơ Sức khỏe Cá nhân
            </h1>
          </div>
          <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-medium border border-emerald-200 dark:border-emerald-900">
            Phiên bản V2
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Theo dõi tổng thể sức khỏe, sinh hoạt, chỉ số và tập luyện. Tùy chọn khai báo, không bắt buộc điền đủ tất cả mục.
        </p>
      </div>

      {/* Cảnh báo lỗi tải dữ liệu (E3) */}
      {hasAnyErrors && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Đã xảy ra lỗi khi tải một số dữ liệu hồ sơ:</span>
            </span>
            <button
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition"
            >
              Tải lại trang
            </button>
          </div>
          <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90 pl-1">
            {errorList.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Thanh Tabs cuộn mượt mà trên Mobile */}
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nội dung tương ứng của từng Tab */}
      <div className="mt-4">
        {activeTab === 'overview' && (
          <HealthOverviewTab
            healthProfile={healthProfile}
            healthProfileError={healthProfileError}
            observations={observations}
            bloodPressures={bloodPressures}
            dailyCheckins={dailyCheckins}
            conditions={conditions}
            allergies={allergies}
            medications={medications}
            healthEvents={healthEvents}
            documents={documents}
            activities={activities}
            goals={goals}
            onNavigateTab={(tabKey) => setActiveTab(tabKey)}
          />
        )}

        {activeTab === 'vitals' && (
          <VitalsTab observations={observations} bloodPressures={bloodPressures} />
        )}

        {activeTab === 'checkin' && (
          <DailyCheckinTab dailyCheckins={dailyCheckins} activities={activities} />
        )}

        {activeTab === 'medical' && (
          <MedicalTab conditions={conditions} allergies={allergies} medications={medications} />
        )}

        {activeTab === 'events_docs' && (
          <EventsAndDocumentsTab healthEvents={healthEvents} documents={documents} />
        )}

        {activeTab === 'training' && (
          <div className="space-y-6">
            <ProfileEditForm
              initialProfile={{
                display_name: userDisplayName,
                experience_level: userExperienceLevel,
                available_equipment: userEquipment,
                schedule_availability: userSchedule,
              }}
              isConfigured={isConfigured}
              fetchError={profileError}
            />

            <GoalsManager
              initialGoals={goals}
              isConfigured={isConfigured}
              fetchError={goalsError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
