'use client';

import React, { useState, useTransition } from 'react';
import { X, UserPlus, Copy, Check, AlertCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { createInviteAction } from '@/app/groups/actions';
import { getInviteDeepLink } from '@/contracts/group.contract';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export function InviteMemberModal({ isOpen, onClose, groupId, groupName }: InviteMemberModalProps) {
  const [isPending, startTransition] = useTransition();

  const [ttlHours, setTtlHours] = useState(168); // 7 ngày
  const [maxUses, setMaxUses] = useState(1);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createInviteAction(groupId, maxUses, ttlHours);
      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Không thể tạo lời mời.');
        return;
      }

      // Xây dựng URL đầy đủ ở trình duyệt phía client
      const fullUrl = `${window.location.origin}${getInviteDeepLink(res.data.rawToken)}`;
      setInviteUrl(fullUrl);
      setCopied(false);
    });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setErrorMsg('Không thể tự động sao chép. Vui lòng bôi đen và copy thủ công.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">Mời bạn bè vào nhóm</h2>
              <span className="text-[11px] text-slate-500 font-normal">{groupName}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Chính sách bảo mật lời mời</span>
          </div>
          <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed">
            Mã lời mời được mã hóa một chiều (SHA-256) trên máy chủ, có thời hạn và số lượt dùng tối đa. Người nhận xem trước thông tin nhóm mà không tự động gia nhập hay lộ cam kết riêng trước khi chấp thuận.
          </p>
        </div>

        {!inviteUrl ? (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Thời hạn hiệu lực (TTL)
              </label>
              <select
                value={ttlHours}
                onChange={(e) => setTtlHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={24}>24 giờ (1 ngày)</option>
                <option value={72}>72 giờ (3 ngày)</option>
                <option value={168}>168 giờ (7 ngày)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Số lượt sử dụng tối đa
              </label>
              <select
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 lượt (dành riêng cho 1 người)</option>
                <option value={2}>2 lượt</option>
                <option value={4}>4 lượt (tối đa sức chứa nhóm)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Tổng số thành viên trong nhóm không bao giờ vượt quá 5 người.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isPending ? 'Đang tạo...' : 'Tạo liên kết mời'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Liên kết mời đã tạo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Hết hạn sau {ttlHours / 24} ngày • Tối đa {maxUses} lượt dùng</span>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInviteUrl(null)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Tạo liên kết khác
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-lg transition"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
