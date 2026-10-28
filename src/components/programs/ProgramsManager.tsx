'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { AlertCircle, CalendarCheck2, Target, ArrowRight, Video, Loader2 } from 'lucide-react';
import { startWorkoutRunAction } from '@/features/workout';
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
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState<SessionEntity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liveSession, setLiveSession] = useState<SessionEntity | null>(null);
  const [liveIdempotencyKey, setLiveIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [isStartingLive, setIsStartingLive] = useState(false);

  const handleOpenRecord = (session: SessionEntity) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSession(null);
  };

  // F3: Nút tập chính khởi tạo run của /workout, thống nhất entry và finalization
  const handleStartLive = async (session: SessionEntity) => {
    try {
      setIsStartingLive(true);
      const res = await startWorkoutRunAction({
        sessionId: session.id,
        sessionTitle: session.title,
      });

      if (res.success && res.data?.runId) {
        router.push(`/workout/${res.data.runId}`);
        return;
      }
    } catch (err) {
      console.error('Lỗi khi khởi động workout run:', err);
    } finally {
      setIsStartingLive(false);
    }
    router.push(`/workout?sessionId=${session.id}`);
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
    formData.append('idempotency_key', data.idempotencyKey || liveIdempotencyKey);
    formData.append('completed_exercises', JSON.stringify(data.completedExercises));

    const res = await recordSessionResultAction(null, formData);
    if (res?.success) {
      setLiveIdempotencyKey(crypto.randomUUID());
    }
    return res;
  };

  return (
    <div className="space-y-5">
      {/* 1. Header chương trình & cảnh báo thử nghiệm */}
      <ProgramHeader program={program} fetchError={programError} />

      {/* 2. Khối Hành Trình Kỹ Năng Có Bằng Chứng (D4 & D6 - Agent C) */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 border border-emerald-500/30 rounded-3xl p-5 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">
                Tiến Trình Thực Tế • D4 & D6
              </span>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Hành Trình Kỹ Năng Có Bằng Chứng
              </h3>
            </div>
          </div>
          <Link
            href="/journey"
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs"
          >
            <span>Mở hành trình</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Tiến trình từng bước chinh phục động tác (Dead Hang, Inverted Row, Negative Pull-up, Standard Pull-up) dựa trên lần thử thực tế và video đối chiếu với chính mình, độc lập hoàn toàn với điểm kinh nghiệm (XP).
        </p>
        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 border-t border-white/10">
          <Link href="/journey/compare" className="text-emerald-400 hover:underline flex items-center gap-1">
            <Video className="w-3.5 h-3.5" />
            <span>Phòng đối chiếu video</span>
          </Link>
          <span>•</span>
          <span>4 trạng thái mốc minh bạch</span>
        </div>
      </div>

      {/* 3. Cây Kỹ Năng Calisthenics Nhập Vai RPG (Gamification) */}
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

      {/* 6. Live Workout Companion Modal (Fallback khi có liveSession) */}
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
