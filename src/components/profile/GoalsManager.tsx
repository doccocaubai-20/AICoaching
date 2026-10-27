'use client';

import React, { useState, useTransition } from 'react';
import {
  Target,
  Plus,
  Trash2,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Edit2,
  X,
} from 'lucide-react';
import {
  createGoalAction,
  updateGoalAction,
  updateGoalStatusAction,
  deleteGoalAction,
  ActionResult,
} from '@/app/profile/actions';
import { GoalEntity, GoalStatus, GoalType } from '@/contracts';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface GoalsManagerProps {
  initialGoals: GoalEntity[];
  isConfigured: boolean;
  fetchError?: string | null;
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  skill: 'Kỹ năng (Skill)',
  endurance: 'Sức bền (Endurance)',
  habit: 'Thói quen (Habit)',
  strength: 'Sức mạnh (Strength)',
  other: 'Khác',
};

const STATUS_BADGES: Record<GoalStatus, { label: string; className: string }> = {
  active: {
    label: 'Đang thực hiện',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  completed: {
    label: 'Đã hoàn thành',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  paused: {
    label: 'Tạm dừng',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  archived: {
    label: 'Đã lưu trữ',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  },
};

export function GoalsManager({ initialGoals, isConfigured, fetchError }: GoalsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [content, setContent] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('skill');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Trạng thái sửa mục tiêu
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editGoalType, setEditGoalType] = useState<GoalType>('skill');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const [isPending, startTransition] = useTransition();
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  const handleStartEdit = (goal: GoalEntity) => {
    setEditingGoalId(goal.id);
    setEditContent(goal.content);
    setEditGoalType(goal.goal_type);
    setEditStartDate(goal.start_date || '');
    setEditEndDate(goal.end_date || '');
    setActionResult(null);
  };

  const handleCancelEdit = () => {
    setEditingGoalId(null);
    setActionResult(null);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    setActionResult(null);

    const formData = new FormData();
    formData.set('content', content);
    formData.set('goal_type', goalType);
    if (startDate) formData.set('start_date', startDate);
    if (endDate) formData.set('end_date', endDate);

    startTransition(async () => {
      const res = await createGoalAction(null, formData);
      setActionResult(res);
      if (res.success) {
        // Chỉ reset form khi thành công; nếu lỗi thì giữ nguyên form!
        setContent('');
        setStartDate('');
        setEndDate('');
        setShowAddForm(false);
      }
    });
  };

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoalId) return;
    setActionResult(null);

    const formData = new FormData();
    formData.set('goal_id', editingGoalId);
    formData.set('content', editContent);
    formData.set('goal_type', editGoalType);
    if (editStartDate) formData.set('start_date', editStartDate);
    if (editEndDate) formData.set('end_date', editEndDate);

    startTransition(async () => {
      const res = await updateGoalAction(null, formData);
      setActionResult(res);
      if (res.success) {
        setEditingGoalId(null);
      }
    });
  };

  const handleStatusChange = (goalId: string, newStatus: GoalStatus) => {
    setActionResult(null);
    startTransition(async () => {
      const res = await updateGoalStatusAction(goalId, newStatus);
      setActionResult(res);
    });
  };

  const handleDeleteGoal = (goalId: string, goalContent: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mục tiêu: "${goalContent}"?`)) {
      return;
    }
    setActionResult(null);
    startTransition(async () => {
      const res = await deleteGoalAction(goalId);
      setActionResult(res);
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Mục tiêu cá nhân
          </h2>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium text-slate-600 dark:text-slate-400">
            {initialGoals.length}
          </span>
        </div>

        <button
          type="button"
          disabled={!isConfigured || isPending}
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingGoalId(null);
            setActionResult(null);
          }}
          className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/60 font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? 'Đóng form' : 'Thêm mục tiêu'}</span>
        </button>
      </div>

      {/* Hiển thị lỗi tải dữ liệu nếu có (không hiển thị như trạng thái rỗng) */}
      {fetchError && (
        <div className="p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {actionResult && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            actionResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
          }`}
        >
          {actionResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{actionResult.message}</span>
        </div>
      )}

      {/* Form thêm mới mục tiêu (giữ nguyên dữ liệu khi lỗi) */}
      {showAddForm && (
        <form
          onSubmit={handleCreateGoal}
          className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
        >
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Tạo mục tiêu rèn luyện mới
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nội dung mục tiêu <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="VD: Hít xà đơn đạt 8 lần chuẩn form, Chống đẩy 20 lần..."
              disabled={isPending}
              required
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {actionResult?.errors?.content && (
              <p className="text-[11px] text-rose-600 mt-1">{actionResult.errors.content}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Loại mục tiêu
              </label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as GoalType)}
                disabled={isPending}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(GOAL_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày bắt đầu (Tùy chọn)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày kết thúc (Tùy chọn)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {actionResult?.errors?.end_date && (
                <p className="text-[11px] text-rose-600 mt-1">{actionResult.errors.end_date}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPending ? 'Đang lưu...' : 'Lưu mục tiêu'}
            </button>
          </div>
        </form>
      )}

      {/* Danh sách mục tiêu hoặc trạng thái */}
      {fetchError ? null : initialGoals.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Target className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500 font-medium">Chưa có mục tiêu nào được thiết lập</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Đặt ra một mục tiêu ngắn hạn (VD: hít xà 5 cái) để AI và dashboard theo dõi cùng bạn.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {initialGoals.map((g) => {
            const isEditing = editingGoalId === g.id;
            const badge = STATUS_BADGES[g.status] || STATUS_BADGES.active;

            if (isEditing) {
              return (
                <form
                  key={g.id}
                  onSubmit={handleUpdateGoal}
                  className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-700 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Chỉnh sửa mục tiêu
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nội dung mục tiêu <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      disabled={isPending}
                      required
                      className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {actionResult?.errors?.content && (
                      <p className="text-[11px] text-rose-600 mt-1">{actionResult.errors.content}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Loại mục tiêu
                      </label>
                      <select
                        value={editGoalType}
                        onChange={(e) => setEditGoalType(e.target.value as GoalType)}
                        disabled={isPending}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        {Object.entries(GOAL_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày bắt đầu
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        disabled={isPending}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày kết thúc
                      </label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        disabled={isPending}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                      {actionResult?.errors?.end_date && (
                        <p className="text-[11px] text-rose-600 mt-1">{actionResult.errors.end_date}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1"
                    >
                      {isPending ? 'Đang cập nhật...' : 'Cập nhật mục tiêu'}
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={g.id}
                className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {GOAL_TYPE_LABELS[g.goal_type] || g.goal_type}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {g.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!isConfigured || isPending}
                      onClick={() => handleStartEdit(g)}
                      title="Sửa mục tiêu"
                      className="text-slate-400 hover:text-emerald-600 p-1 rounded-md transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!isConfigured || isPending}
                      onClick={() => handleDeleteGoal(g.id, g.content)}
                      title="Xóa mục tiêu"
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    {(g.start_date || g.end_date) && (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {g.start_date ? formatDateVN(g.start_date) : 'Hôm nay'}
                          {g.end_date ? ` → ${formatDateVN(g.end_date)}` : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Nút chuyển nhanh trạng thái */}
                  <div className="flex items-center gap-1">
                    {g.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={!isConfigured || isPending}
                        onClick={() => handleStatusChange(g.id, 'completed')}
                        className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 rounded text-[10px] font-medium hover:bg-blue-100 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Xong</span>
                      </button>
                    )}

                    {g.status === 'active' ? (
                      <button
                        type="button"
                        disabled={!isConfigured || isPending}
                        onClick={() => handleStatusChange(g.id, 'paused')}
                        className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded text-[10px] font-medium hover:bg-amber-100 flex items-center gap-1"
                      >
                        <PauseCircle className="w-3 h-3" />
                        <span>Tạm dừng</span>
                      </button>
                    ) : g.status === 'paused' || g.status === 'completed' ? (
                      <button
                        type="button"
                        disabled={!isConfigured || isPending}
                        onClick={() => handleStatusChange(g.id, 'active')}
                        className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 rounded text-[10px] font-medium hover:bg-emerald-100 flex items-center gap-1"
                      >
                        <PlayCircle className="w-3 h-3" />
                        <span>Tiếp tục</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
