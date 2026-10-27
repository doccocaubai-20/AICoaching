'use client';

import React, { useState } from 'react';
import {
  ProgramEntity,
  SessionEntity,
  SessionResultEntity,
  ReviewSuggestionEntity,
} from '@/contracts';
import { ProgramHeader } from './ProgramHeader';
import { SessionCard } from './SessionCard';
import { SessionResultModal } from './SessionResultModal';
import { LiveWorkoutModal } from './LiveWorkoutModal';
import { SkillTreeSection } from './SkillTreeSection';
import { SessionHistoryList } from './SessionHistoryList';
import { ReviewSuggestionsSection } from '@/components/review/ReviewSuggestionsSection';
import { AlertCircle, CalendarCheck2 } from 'lucide-react';
import { recordSessionResultAction } from '@/app/programs/actions';

interface ProgramsManagerProps {
  program: ProgramEntity | null;
  sessions: SessionEntity[];
  sessionResults: SessionResultEntity[];
  suggestions: ReviewSuggestionEntity[];
  isConfigured: boolean;
  programError?: string | null;
  sessionsError?: string | null;
  resultsError?: string | null;
  suggestionsError?: string | null;
}

export function ProgramsManager({
  program,
  sessions,
  sessionResults,
  suggestions,
  isConfigured,
  programError,
  sessionsError,
  resultsError,
  suggestionsError,
}: ProgramsManagerProps) {
  const [selectedSession, setSelectedSession] = useState<SessionEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liveSession, setLiveSession] = useState<SessionEntity | null>(null);
  // [E10] Khóa idempotency ổn định cho một lượt tập (tái sử dụng khi retry)
  const [liveIdempotencyKey, setLiveIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const handleOpenRecord = (session: SessionEntity) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSession(null);
  };

  const handleStartLive = (session: SessionEntity) => {
    setLiveSession(session);
    setLiveIdempotencyKey(crypto.randomUUID());
  };

  const handleFinishLiveWorkout = async (data: {
    durationMinutes: number;
    perceivedExertion: number;
    notes: string;
    completedExercises: Array<unknown>;
    idempotencyKey?: string;
  }) => {
    if (!liveSession) return { success: false, message: 'Không tìm thấy buổi tập.' };
    const formData = new FormData();
    formData.append('session_id', liveSession.id);
    formData.append('completed_at', new Date().toISOString());
    formData.append('duration_minutes', String(data.durationMinutes));
    formData.append('perceived_exertion', String(data.perceivedExertion));
    formData.append('notes', data.notes);
    // [E10] Dùng chung idempotency_key qua các lần gọi lại của cùng lượt tập
    formData.append('idempotency_key', data.idempotencyKey || liveIdempotencyKey);
    formData.append('completed_exercises', JSON.stringify(data.completedExercises));

    const res = await recordSessionResultAction(null, formData);
    if (res?.success) {
      // Chỉ sinh khóa mới khi đã ghi nhận thành công
      setLiveIdempotencyKey(crypto.randomUUID());
    }
    return res;
  };

  return (
    <div className="space-y-5">
      {/* 1. Header chương trình & cảnh báo thử nghiệm */}
      <ProgramHeader program={program} fetchError={programError} />

      {/* 2. Cây Kỹ Năng Calisthenics Nhập Vai RPG (Đột Phá) */}
      <SkillTreeSection sessionResults={sessionResults} fetchError={resultsError} />

      {/* 3. Danh sách các buổi tập trong chương trình mẫu */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Các buổi tập mẫu (Đọc từ Database)
          </h2>
          <span className="text-[11px] text-slate-500">
            {sessions.length} buổi tập
          </span>
        </div>

        {sessionsError ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Không tải được danh sách buổi tập</p>
              <p className="text-[11px] mt-0.5">{sessionsError}</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
            <CalendarCheck2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">
              Chưa có buổi tập mẫu nào trong cơ sở dữ liệu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRecordResult={handleOpenRecord}
                onStartLive={handleStartLive}
                isConfigured={isConfigured}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Lịch sử kết quả tự khai của người dùng */}
      <SessionHistoryList
        results={sessionResults}
        sessions={sessions}
        fetchError={resultsError}
      />

      {/* 4. Quy tắc xem lại lịch nhiều hoạt động (P1) */}
      <ReviewSuggestionsSection
        suggestions={suggestions}
        isConfigured={isConfigured}
        fetchError={suggestionsError}
      />

      {/* 5. Modal ghi kết quả buổi tập */}
      <SessionResultModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        session={selectedSession}
        isConfigured={isConfigured}
      />

      {/* 6. Live Workout Companion Modal (Trực Tiếp Có Bấm Giờ Nghỉ & Âm Thanh) */}
      {liveSession && (
        <LiveWorkoutModal
          session={liveSession}
          onFinishWorkout={handleFinishLiveWorkout}
          onClose={() => setLiveSession(null)}
        />
      )}
    </div>
  );
}
