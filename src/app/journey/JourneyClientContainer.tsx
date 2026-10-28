'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, AlertCircle } from 'lucide-react';
import type { JourneyDetails, SkillMilestone, SourceRef } from '@/features/skills/contracts/skills.contract';
import { JourneyHeader } from '@/features/skills/components/JourneyHeader';
import { MilestoneCard } from '@/features/skills/components/MilestoneCard';
import { AttemptRecordModal } from '@/features/skills/components/AttemptRecordModal';
import { deleteJourneyAttemptAction } from '@/features/skills/server/skills-actions';

interface JourneyClientContainerProps {
  initialDetails: JourneyDetails;
  initialEvidence?: SourceRef | null;
  initialMilestoneId?: string;
}

export function JourneyClientContainer({ initialDetails, initialEvidence, initialMilestoneId }: JourneyClientContainerProps) {
  const router = useRouter();
  const [selectedMilestone, setSelectedMilestone] = useState<SkillMilestone | null>(initialDetails.milestones.find(m=>m.milestone.id===initialMilestoneId)?.milestone || null);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialMilestoneId));

  const { journey, milestones, totalMilestones, achievedMilestonesCount, needsReviewMilestonesCount, attemptedMilestonesCount } = initialDetails;

  const handleOpenRecord = (milestoneId: string) => {
    const found = milestones.find((m) => m.milestone.id === milestoneId);
    if (found) {
      setSelectedMilestone(found.milestone);
      setIsModalOpen(true);
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa lần thử này?')) {
      await deleteJourneyAttemptAction(attemptId);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Thống kê */}
      <JourneyHeader
        journey={journey}
        totalMilestones={totalMilestones}
        achievedCount={achievedMilestonesCount}
        needsReviewCount={needsReviewMilestonesCount}
        attemptedCount={attemptedMilestonesCount}
      />

      {/* Danh sách các Mốc tiêu chí */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            Các Mốc Tiêu Chí Kỹ Năng ({milestones.length})
          </h2>
          <span className="text-xs text-slate-500">
            Theo thứ tự độ khó từ cơ bản đến nâng cao
          </span>
        </div>

        <div className="space-y-3.5">
          {milestones.map((p) => (
            <MilestoneCard
              key={p.milestone.id}
              progress={p}
              onRecordAttempt={handleOpenRecord}
              onDeleteAttempt={handleDeleteAttempt}
            />
          ))}
        </div>
      </div>

      {/* Modal ghi nhận lần thử */}
      {selectedMilestone && (
        <AttemptRecordModal
          key={selectedMilestone.id}
          initialSource={selectedMilestone.id === initialMilestoneId ? initialEvidence : null}
          milestone={selectedMilestone}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMilestone(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
