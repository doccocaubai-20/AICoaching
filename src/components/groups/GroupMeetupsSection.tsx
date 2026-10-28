'use client';

import React, { useState, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Info,
  Users,
} from 'lucide-react';
import {
  GroupMeetupEntity,
  RSVPStatus,
  RSVP_STATUS_LABELS,
} from '@/contracts/group.contract';
import { formatDateTimeVN, getRSVPBadgeStyle } from './group-utils';
import { rsvpMeetupAction } from '@/app/groups/actions';
import { MeetupFormModal } from './MeetupFormModal';

interface GroupMeetupsSectionProps {
  groupId: string;
  currentUserId: string;
  meetups: GroupMeetupEntity[];
}

export function GroupMeetupsSection({
  groupId,
  currentUserId,
  meetups,
}: GroupMeetupsSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMeetup, setEditingMeetup] = useState<GroupMeetupEntity | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenCreate = () => {
    setEditingMeetup(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (m: GroupMeetupEntity) => {
    setEditingMeetup(m);
    setIsFormOpen(true);
  };

  const handleRSVP = (meetupId: string, status: RSVPStatus, currentRevision: number) => {
    startTransition(async () => {
      await rsvpMeetupAction(meetupId, groupId, status, currentRevision);
    });
  };

  return (
    <div className="space-y-4">
      {/* Cảnh báo rõ ràng ranh giới tính năng */}
      <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Hoạt động hẹn gặp chung:</strong> Tính năng dùng để các thành viên sắp xếp thời gian và địa điểm tập luyện cùng nhau. Hệ thống <strong>không tự động ghi buổi tập thực tế</strong> vào nhật ký cá nhân hay hồ sơ của bất kỳ ai.
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Lịch hẹn nhóm ({meetups.length})
          </h3>
          <span className="text-[11px] text-slate-400">Có theo dõi phiên bản sửa đổi (Revision)</span>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Hẹn buổi mới</span>
        </button>
      </div>

      {/* List */}
      {meetups.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
          <p className="text-xs">Chưa có buổi hẹn tập luyện nào được tạo.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Lên lịch hẹn buổi tập đầu tiên →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meetups.map((meetup) => {
            const myRsvp = meetup.rsvps?.find((r) => r.user_id === currentUserId);
            // Kiểm tra xem revision của user có cũ hơn revision hiện tại không
            const needsReconfirm =
              myRsvp && myRsvp.acknowledged_revision < meetup.revision;

            const isCreator = meetup.created_by === currentUserId;

            const goingCount = meetup.rsvps?.filter((r) => r.status === 'going').length || 0;
            const maybeCount = meetup.rsvps?.filter((r) => r.status === 'maybe').length || 0;

            return (
              <div
                key={meetup.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                {/* Header & Revision */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {meetup.title}
                      </h4>
                      {meetup.revision > 1 && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 font-medium">
                          Phiên bản {meetup.revision}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Tạo bởi: {meetup.creator_display_name || 'Thành viên'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(meetup)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Chỉnh sửa lịch hẹn"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDateTimeVN(meetup.scheduled_at)}
                    </span>
                  </div>

                  {meetup.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{meetup.location}</span>
                    </div>
                  )}

                  {meetup.notes && (
                    <p className="text-slate-500 dark:text-slate-400 italic text-[11px] pt-1">
                      &quot;{meetup.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Banner thông báo thay đổi revision cần xác nhận lại */}
                {needsReconfirm && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Lịch hẹn đã thay đổi{meetup.revision_note ? `: "${meetup.revision_note}"` : ''}. Vui lòng xác nhận lại!
                      </span>
                    </div>
                  </div>
                )}

                {/* RSVP Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {goingCount} tham gia • {maybeCount} có thể
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">Bạn:</span>
                    {(['going', 'maybe', 'declined'] as RSVPStatus[]).map((st) => {
                      const isSelected = myRsvp?.status === st;
                      const isStale = isSelected && needsReconfirm;

                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleRSVP(meetup.id, st, meetup.revision)}
                          disabled={isPending}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${
                            isSelected
                              ? isStale
                                ? 'bg-amber-500 text-white animate-pulse'
                                : 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {st === 'going' && <CheckCircle2 className="w-3 h-3" />}
                          {st === 'maybe' && <HelpCircle className="w-3 h-3" />}
                          {st === 'declined' && <XCircle className="w-3 h-3" />}
                          <span>{RSVP_STATUS_LABELS[st]}</span>
                          {isStale && <span className="text-[10px] underline ml-0.5">(Xác nhận lại)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      <MeetupFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        groupId={groupId}
        existingMeetup={editingMeetup}
      />
    </div>
  );
}
