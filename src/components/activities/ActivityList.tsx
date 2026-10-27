'use client';

import React, { useState, useMemo } from 'react';
import { CalendarCheck2, Filter, Plus, RotateCcw } from 'lucide-react';
import { ActivityEntity, ActivityType } from '@/contracts';
import {
  filterActivities,
  ActivityFilterOptions,
  ACTIVITY_TYPE_LABELS,
} from './activity-utils';
import { ActivityItem } from './ActivityItem';

interface ActivityListProps {
  activities: ActivityEntity[];
  onOpenCreate: () => void;
  onEditActivity: (activity: ActivityEntity) => void;
  isConfigured: boolean;
}

export function ActivityList({
  activities,
  onOpenCreate,
  onEditActivity,
  isConfigured,
}: ActivityListProps) {
  const [selectedType, setSelectedType] = useState<ActivityType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'actual' | 'planned'>('all');

  const filteredActivities = useMemo(() => {
    return filterActivities(activities, {
      type: selectedType,
      status: selectedStatus,
    });
  }, [activities, selectedType, selectedStatus]);

  const hasActiveFilters = selectedType !== 'all' || selectedStatus !== 'all';

  const resetFilters = () => {
    setSelectedType('all');
    setSelectedStatus('all');
  };

  return (
    <div className="space-y-4">
      {/* Thanh bộ lọc */}
      <div className="space-y-2">
        {/* Bộ lọc loại môn */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
              selectedType === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả môn
          </button>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
                selectedType === type
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {ACTIVITY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Bộ lọc trạng thái: Tất cả / Đã tập / Lịch dự kiến */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Trạng thái:</span>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  selectedStatus === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('actual')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  selectedStatus === 'actual'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Đã tập
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('planned')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  selectedStatus === 'planned'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Lịch dự kiến
              </button>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 underline transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Danh sách bản ghi */}
      {activities.length === 0 ? (
        // Trạng thái rỗng hoàn toàn (Chưa có bản ghi nào)
        // Lưu ý theo BAN_GIAO: ghi "Chưa ghi hoạt động nào", KHÔNG ghi "Bạn chưa tập"
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center">
            <CalendarCheck2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Chưa ghi hoạt động nào
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Bạn có thể ghi nhận calisthenics, chạy bộ, cầu lông, đi bộ hoặc lên kế hoạch dự kiến để theo dõi quá trình rèn luyện cá nhân.
            </p>
          </div>
          <button
            type="button"
            disabled={!isConfigured}
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi hoạt động đầu tiên</span>
          </button>
        </div>
      ) : filteredActivities.length === 0 ? (
        // Có dữ liệu nhưng bộ lọc không khớp dòng nào
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <p className="text-xs text-slate-500 font-medium">
            Không tìm thấy hoạt động nào phù hợp với bộ lọc đã chọn.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      ) : (
        // Danh sách hoạt động
        <div className="space-y-2.5">
          {filteredActivities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onEdit={onEditActivity}
              isConfigured={isConfigured}
            />
          ))}
        </div>
      )}
    </div>
  );
}
