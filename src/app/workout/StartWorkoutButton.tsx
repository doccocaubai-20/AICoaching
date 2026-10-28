'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2 } from 'lucide-react';
import { startWorkoutRunAction } from '@/features/workout';

interface StartWorkoutButtonProps {
  sessionId?: string;
  programId?: string;
  sessionTitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function StartWorkoutButton({
  sessionId,
  programId,
  sessionTitle,
  className,
  children,
}: StartWorkoutButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const res = await startWorkoutRunAction({
        sessionId,
        programId,
        sessionTitle,
      });

      if (res.success && res.data) {
        router.push(`/workout/${res.data.runId}`);
      } else {
        setError(res.message || 'Không thể bắt đầu buổi tập.');
        setIsStarting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối.');
      setIsStarting(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleStart}
        disabled={isStarting}
        className={
          className ||
          'w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/30 disabled:opacity-50'
        }
      >
        {isStarting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang chuẩn bị buổi tập...</span>
          </>
        ) : (
          children || (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Bắt đầu buổi tập</span>
            </>
          )
        )}
      </button>

      {error && (
        <div className="mt-2 text-xs text-rose-400 text-center">{error}</div>
      )}
    </div>
  );
}
