'use client';

import React, { useState } from 'react';
import { CalendarCheck2, Plus, AlertCircle, ShieldAlert } from 'lucide-react';
import { ActivityEntity } from '@/contracts';
import { ActivityList } from './ActivityList';
import { ActivityFormModal } from './ActivityFormModal';

interface ActivityManagerProps {
  initialActivities: ActivityEntity[];
  isConfigured: boolean;
  fetchError?: string | null;
  highlightId?: string;
}

export function ActivityManager({
  initialActivities,
  isConfigured,
  fetchError,
  highlightId,
}: ActivityManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingActivity, setEditingActivity] = useState<ActivityEntity | null>(null);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingActivity(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (activity: ActivityEntity) => {
    setModalMode('edit');
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  return (
    <div className="space-y-4">
      {/* Tiêu đề trang & Nút thêm */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-emerald-600" />
            <span>Nhật ký hoạt động</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Calisthenics, chạy bộ, cầu lông, đi bộ và các môn khác
          </p>
        </div>

        <button
          type="button"
          disabled={!isConfigured}
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-xl transition shadow-xs disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm hoạt động</span>
        </button>
      </div>

      {/* Cam kết dữ liệu & nguyên tắc MVP */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quy tắc nhật ký</span>
        </div>
        <p>
          Phân biệt rõ <strong>Lịch dự kiến</strong> và <strong>Đã tập thực tế</strong>. Thiếu dữ liệu không có nghĩa là không tập. Hệ thống <strong>không tự động kết luận hồi phục</strong> hoặc <strong>thay đổi tải tập</strong>.
        </p>
      </div>

      {/* Thông báo lỗi khi truy vấn database thất bại (Không hiện empty state giả) */}
      {fetchError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Danh sách hoạt động & bộ lọc. Tải lỗi thì không hiện danh sách để tránh trạng thái rỗng giả */}
      {!fetchError && (
        <ActivityList
          activities={initialActivities}
          onOpenCreate={handleOpenCreate}
          onEditActivity={handleOpenEdit}
          isConfigured={isConfigured}
          highlightId={highlightId}
        />
      )}

      {/* Modal Thêm / Sửa hoạt động */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode={modalMode}
        initialActivity={editingActivity}
        isConfigured={isConfigured}
      />
    </div>
  );
}
