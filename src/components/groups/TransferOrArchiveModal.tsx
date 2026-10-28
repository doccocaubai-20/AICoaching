'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle, ShieldCheck, Archive, UserCheck, Loader2 } from 'lucide-react';
import { transferOwnershipAction, archiveGroupAction, leaveGroupAction } from '@/app/groups/actions';
import { GroupMemberEntity } from '@/contracts/group.contract';

interface TransferOrArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  isOwner: boolean;
  otherActiveMembers: GroupMemberEntity[];
}

export function TransferOrArchiveModal({
  isOpen,
  onClose,
  groupId,
  isOwner,
  otherActiveMembers,
}: TransferOrArchiveModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<'choose' | 'transfer' | 'archive'>('choose');
  const [selectedMemberId, setSelectedMemberId] = useState(
    otherActiveMembers.length > 0 ? otherActiveMembers[0].user_id : ''
  );
  const [confirmArchiveText, setConfirmArchiveText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Nếu không phải owner: chỉ là xác nhận rời nhóm thông thường
  if (!isOwner) {
    const handleLeave = () => {
      setErrorMsg(null);
      startTransition(async () => {
        const res = await leaveGroupAction(groupId);
        if (!res.success) {
          setErrorMsg(res.message || 'Không thể rời nhóm.');
          return;
        }
        onClose();
        router.push('/groups');
      });
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">Xác nhận rời nhóm</h2>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Bạn có chắc chắn muốn rời nhóm? Sau khi rời, bạn sẽ mất quyền truy cập vào cam kết và hoạt động của nhóm ngay lập tức. Dữ liệu tập luyện cá nhân của bạn hoàn toàn được giữ nguyên an toàn.
          </p>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleLeave}
              disabled={isPending}
              className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isPending ? 'Đang rời...' : 'Rời nhóm'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Owner rời nhóm: Nếu chỉ có 1 mình owner trong nhóm -> archive và rời
  const hasOtherMembers = otherActiveMembers.length > 0;

  const handleTransfer = () => {
    if (!selectedMemberId) {
      setErrorMsg('Vui lòng chọn thành viên nhận quyền.');
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await transferOwnershipAction(groupId, selectedMemberId);
      if (!res.success) {
        setErrorMsg(res.message || 'Không thể chuyển quyền.');
        return;
      }
      // Sau khi chuyển quyền, tiến hành rời nhóm
      const leaveRes = await leaveGroupAction(groupId);
      if (!leaveRes.success) {
        setErrorMsg(leaveRes.message || 'Chuyển quyền xong nhưng chưa rời được nhóm.');
        return;
      }
      onClose();
      router.push('/groups');
    });
  };

  const handleArchive = () => {
    if (confirmArchiveText.trim() !== 'XÁC NHẬN') {
      setErrorMsg('Vui lòng gõ đúng chữ "XÁC NHẬN" để giải tán nhóm.');
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await archiveGroupAction(groupId);
      if (!res.success) {
        setErrorMsg(res.message || 'Không thể giải tán nhóm.');
        return;
      }
      await leaveGroupAction(groupId);
      onClose();
      router.push('/groups');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-base">Chính sách khi Chủ nhóm rời</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          Theo hợp đồng G0: Để đảm bảo không để nhóm vô chủ, chủ nhóm bắt buộc phải{' '}
          <strong>chuyển quyền cho thành viên khác</strong> hoặc <strong>lưu trữ/giải tán nhóm có xác nhận</strong> trước khi rời.
        </div>

        {hasOtherMembers ? (
          mode === 'choose' ? (
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => setMode('transfer')}
                className="w-full p-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-800 transition flex items-start gap-3"
              >
                <UserCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Chuyển quyền chủ nhóm cho thành viên khác
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Chọn 1 trong các thành viên đang hoạt động để làm chủ nhóm mới, sau đó bạn sẽ rời nhóm.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('archive')}
                className="w-full p-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-500 bg-white dark:bg-slate-800 transition flex items-start gap-3"
              >
                <Archive className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Giải tán / Lưu trữ toàn bộ nhóm
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Đóng nhóm lại vĩnh viễn cho tất cả các thành viên.
                  </div>
                </div>
              </button>
            </div>
          ) : mode === 'transfer' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn chủ nhóm mới:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {otherActiveMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name || 'Thành viên'} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isPending || !selectedMemberId}
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Chuyển quyền và rời nhóm</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Thao tác này sẽ lưu trữ/giải tán nhóm. Mọi thành viên sẽ không thể gửi cam kết hay tạo lịch hẹn mới.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Gõ <strong>XÁC NHẬN</strong> để đồng ý giải tán:
                </label>
                <input
                  type="text"
                  value={confirmArchiveText}
                  onChange={(e) => setConfirmArchiveText(e.target.value)}
                  placeholder="XÁC NHẬN"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={isPending || confirmArchiveText.trim() !== 'XÁC NHẬN'}
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Giải tán nhóm và rời</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn là thành viên duy nhất còn lại trong nhóm. Khi bạn rời, nhóm sẽ được lưu trữ tự động.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    const res = await leaveGroupAction(groupId);
                    if (!res.success) {
                      setErrorMsg(res.message || 'Không thể rời nhóm.');
                      return;
                    }
                    onClose();
                    router.push('/groups');
                  });
                }}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Lưu trữ nhóm và rời đi</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
