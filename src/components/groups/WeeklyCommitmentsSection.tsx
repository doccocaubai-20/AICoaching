'use client';

import React, { useState, useTransition } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  CheckCircle2,
  Sparkles,
  Send,
  MessageSquare,
  Share2,
  Copy,
  Check,
  Loader2,
  User,
} from 'lucide-react';
import {
  GroupCommitmentEntity,
  GroupEntity,
  GroupMemberEntity,
  ReactionType,
  REACTION_SYMBOLS,
  exportGroupWeekSummary,
} from '@/contracts/group.contract';
import {
  formatWeekRangeVN,
  getShiftedWeekStart,
  getCommitmentStatusBadgeStyle,
  sanitizeTextMessage,
} from './group-utils';
import {
  updateCommitmentStatusAction,
  toggleReactionAction,
  addFeedbackMessageAction,
} from '@/app/groups/actions';
import { CommitmentFormModal } from './CommitmentFormModal';

interface WeeklyCommitmentsSectionProps {
  group: GroupEntity;
  currentUserId: string;
  members: GroupMemberEntity[];
  initialWeekStart: string;
  commitments: GroupCommitmentEntity[];
}

export function WeeklyCommitmentsSection({
  group,
  currentUserId,
  members,
  initialWeekStart,
  commitments,
}: WeeklyCommitmentsSectionProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<GroupCommitmentEntity | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Quick message input per commitment
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Tìm cam kết của chính mình trong tuần được chọn
  const myCommitment = commitments.find(
    (c) => c.user_id === currentUserId && c.week_start === weekStart
  );

  // Lọc cam kết cho tuần hiện tại
  const currentWeekCommitments = commitments.filter((c) => c.week_start === weekStart);

  const handlePrevWeek = () => {
    setWeekStart((prev) => getShiftedWeekStart(prev, -1));
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => getShiftedWeekStart(prev, 1));
  };

  const handleOpenMyModal = () => {
    setEditingCommitment(myCommitment || null);
    setIsFormOpen(true);
  };

  const handleToggleReaction = (commitmentId: string, type: ReactionType) => {
    startTransition(async () => {
      await toggleReactionAction(commitmentId, group.id, type);
    });
  };

  const handleSendMessage = (commitmentId: string) => {
    const rawMsg = messageInputs[commitmentId] || '';
    const cleanMsg = sanitizeTextMessage(rawMsg);
    if (!cleanMsg) return;

    startTransition(async () => {
      const res = await addFeedbackMessageAction(commitmentId, group.id, cleanMsg);
      if (res.success) {
        setMessageInputs((prev) => ({ ...prev, [commitmentId]: '' }));
      }
    });
  };

  const handleCopySummary = async () => {
    const summary = exportGroupWeekSummary(group, currentWeekCommitments, weekStart, members.length);
    try {
      await navigator.clipboard.writeText(summary.summary_text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleQuickIncrement = (c: GroupCommitmentEntity) => {
    startTransition(async () => {
      const newCount = (c.completed_count || 0) + 1;
      const isNowCompleted = c.target_count && newCount >= c.target_count ? 'completed' : c.status;
      await updateCommitmentStatusAction(c.id, group.id, isNowCompleted, newCount);
    });
  };

  return (
    <div className="space-y-4">
      {/* Week Navigation Header */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Tuần trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 px-1">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Tuần {formatWeekRangeVN(weekStart)}</span>
          </div>

          <button
            type="button"
            onClick={handleNextWeek}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Tuần sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition flex items-center gap-1"
            title="Sao chép tóm tắt tuần"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedSummary ? 'Đã sao chép' : 'Tóm tắt'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenMyModal}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            {myCommitment ? (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                <span>Sửa cam kết</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Đặt cam kết tuần</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cam kết của chính người dùng được highlight ở trên nếu có */}
      {myCommitment && (
        <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cam kết của bạn tuần này</span>
            </span>

            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                getCommitmentStatusBadgeStyle(myCommitment.status).className
              }`}
            >
              {getCommitmentStatusBadgeStyle(myCommitment.status).label}
            </span>
          </div>

          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {myCommitment.content}
          </p>

          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="text-slate-600 dark:text-slate-400 font-medium">
              Tiến độ:{' '}
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                {myCommitment.completed_count}
                {myCommitment.target_count ? `/${myCommitment.target_count}` : ''} lần
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleQuickIncrement(myCommitment)}
              disabled={isPending}
              className="px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-100 rounded-md border border-emerald-300 dark:border-emerald-700 transition flex items-center gap-1 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>+1 lần hoàn thành</span>
            </button>
          </div>
        </div>
      )}

      {/* Danh sách cam kết của từng thành viên trong nhóm */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Cam kết các thành viên ({currentWeekCommitments.length}/{members.length})
          </h3>
          <span className="text-[11px] text-slate-400">Không xếp hạng • Động viên tích cực</span>
        </div>

        {currentWeekCommitments.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="text-xs">Chưa có thành viên nào đặt cam kết cho tuần này.</p>
            <button
              type="button"
              onClick={handleOpenMyModal}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              Là người đầu tiên đặt cam kết tuần →
            </button>
          </div>
        ) : (
          currentWeekCommitments.map((commitment) => {
            const isMe = commitment.user_id === currentUserId;
            const statusStyle = getCommitmentStatusBadgeStyle(commitment.status);
            const userMsg = messageInputs[commitment.id] || '';

            return (
              <div
                key={commitment.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                {/* Member Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block leading-tight">
                        {commitment.user_display_name || (isMe ? 'Bạn' : 'Thành viên')}
                        {isMe && <span className="text-[10px] text-emerald-600 ml-1 font-normal">(Tôi)</span>}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle.className}`}>
                    {statusStyle.label}
                  </span>
                </div>

                {/* Content */}
                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {commitment.content}
                </div>

                {/* Progress / Note */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    {commitment.target_count ? (
                      <span>
                        Mục tiêu: {commitment.completed_count}/{commitment.target_count} lần
                      </span>
                    ) : commitment.completed_count > 0 ? (
                      <span>Đã làm: {commitment.completed_count} lần</span>
                    ) : (
                      <span>Chưa ghi nhận số lần</span>
                    )}
                  </div>
                  {commitment.notes && (
                    <span className="italic max-w-[200px] truncate text-slate-400">
                      &quot;{commitment.notes}&quot;
                    </span>
                  )}
                </div>

                {/* Reactions Row */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {(['clap', 'fire', 'muscle', 'heart'] as ReactionType[]).map((rx) => {
                    const rxList = commitment.reactions?.filter((r) => r.reaction_type === rx) || [];
                    const hasMyRx = rxList.some((r) => r.user_id === currentUserId);
                    const count = rxList.length;

                    return (
                      <button
                        key={rx}
                        type="button"
                        onClick={() => handleToggleReaction(commitment.id, rx)}
                        disabled={isPending}
                        className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${
                          hasMyRx
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-transparent'
                        }`}
                        title={`Thả ${rx}`}
                      >
                        <span>{REACTION_SYMBOLS[rx]}</span>
                        {count > 0 && <span className="text-[10px] font-semibold">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Short Feedback Messages List */}
                {commitment.feedback_messages && commitment.feedback_messages.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Lời động viên:
                    </span>
                    <div className="space-y-1">
                      {commitment.feedback_messages.map((msg) => (
                        <div
                          key={msg.id}
                          className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                        >
                          <span className="font-semibold text-slate-900 dark:text-slate-100 mr-1.5">
                            {msg.user_display_name || 'Người quen'}:
                          </span>
                          <span>{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Input */}
                <div className="pt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={280}
                    placeholder="Gửi lời động viên ngắn (tối đa 280 ký tự)..."
                    value={userMsg}
                    onChange={(e) =>
                      setMessageInputs((prev) => ({ ...prev, [commitment.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendMessage(commitment.id);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage(commitment.id)}
                    disabled={isPending || !userMsg.trim()}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white transition shrink-0"
                    title="Gửi"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal chỉnh sửa cam kết của chính mình */}
      <CommitmentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        groupId={group.id}
        weekStart={weekStart}
        existingCommitment={editingCommitment}
      />
    </div>
  );
}
