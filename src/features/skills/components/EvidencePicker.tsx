'use client';

import React, { useState, useEffect } from 'react';
import { FileCheck, Activity, Dumbbell, Check, X } from 'lucide-react';
import type { SourceRef } from '../contracts/skills.contract';

interface EligibleSourceItem {
  id: string;
  sourceType: 'activity' | 'session_result';
  title: string;
  date: string;
  details: string;
}

interface EvidencePickerProps {
  selectedSource: SourceRef | null;
  onSelectSource: (source: SourceRef | null) => void;
  exerciseId?: string;
}

export function EvidencePicker({
  selectedSource,
  onSelectSource,
}: EvidencePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<EligibleSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Giả lập hoặc lấy danh sách các hoạt động / kết quả gần đây
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Tải từ fetch API nội bộ hoặc stub danh sách hoạt động nền
      fetch('/api/health')
        .then(() => {
          // Trả về các mục minh họa nguồn thực
          setItems([
            {
              id: 'act-sample-1',
              sourceType: 'activity',
              title: 'Buổi tập Calisthenics cơ bản',
              date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              details: '45 phút • Độ mệt RPE: 7/10',
            },
            {
              id: 'sess-sample-1',
              sourceType: 'session_result',
              title: 'Buổi tập Full Body Calisthenics',
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
              details: 'Hoàn thành 4 bài • 16 hiệp',
            },
          ]);
        })
        .catch(() => {
          setItems([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Gắn kết quả nền đã có quyền đọc (Tùy chọn)</span>
        </label>
        {selectedSource && (
          <button
            type="button"
            onClick={() => onSelectSource(null)}
            className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Bỏ gắn
          </button>
        )}
      </div>

      {selectedSource ? (
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-semibold text-blue-900 dark:text-blue-200 uppercase text-[10px]">
                {selectedSource.sourceType}:
              </span>{' '}
              <span className="text-blue-800 dark:text-blue-300 font-mono text-[11px]">
                {selectedSource.sourceId.slice(0, 12)}...
              </span>
              <div className="text-[10px] text-blue-600 dark:text-blue-400">
                Ghi nhận lúc: {new Date(selectedSource.recordedAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Đổi nguồn
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full text-left p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between transition-colors"
          >
            <span>Chọn từ Nhật ký hoạt động hoặc Buổi tập đã hoàn thành...</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Mở danh sách</span>
          </button>
        </div>
      )}

      {isOpen && (
        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2 mt-1 shadow-sm max-h-48 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Nguồn hoạt động nền khả dụng:
          </div>

          {isLoading ? (
            <div className="text-xs text-slate-400 py-2 text-center">Đang tải nguồn...</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-slate-400 py-2 text-center">
              Chưa có bản ghi hoạt động nào phù hợp. Bạn vẫn có thể ghi lần thử độc lập.
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectSource({
                      sourceType: item.sourceType,
                      sourceId: item.id,
                      recordedAt: item.date,
                    });
                    setIsOpen(false);
                  }}
                  className="p-2 rounded border border-slate-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {item.sourceType === 'activity' ? (
                      <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Dumbbell className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.details} • {new Date(item.date).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium">Chọn</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-700">
            * Khi bản ghi nguồn bị sửa hoặc xóa, lần thử kỹ năng sẽ tự động đổi sang trạng thái &quot;Cần xem lại&quot;.
          </div>
        </div>
      )}
    </div>
  );
}
