/**
 * CALISCOACHING - CONTRACT G0: NHÓM NHỎ CÙNG GIỮ CAM KẾT (D5)
 * Định nghĩa các kiểu thực thể, hợp đồng dữ liệu, validation và tiện ích tích hợp
 * cho nhóm 1-5 người quen có cam kết cá nhân hàng tuần và phản hồi động viên.
 */

export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupStatus = 'active' | 'archived';
export type MemberStatus = 'active' | 'left' | 'removed';
export type CommitmentStatus = 'planned' | 'completed' | 'rescheduled' | 'needs_companion';
export type ReactionType = 'clap' | 'fire' | 'muscle' | 'heart';
export type RSVPStatus = 'going' | 'maybe' | 'declined';

export interface GroupEntity {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  created_by: string;
  status: GroupStatus;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberEntity {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  status: MemberStatus;
  is_muted: boolean;
  joined_at: string;
  left_at: string | null;
  display_name?: string;
}

export interface GroupInviteEntity {
  id: string;
  group_id: string;
  token_hash: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  is_revoked: boolean;
  created_at: string;
}

export interface GroupInvitePreview {
  group_id: string | null;
  group_name: string;
  group_description: string | null;
  group_timezone: string;
  member_count: number;
  inviter_display_name: string;
  expires_at: string;
  is_valid: boolean;
  invalid_reason?: string | null;
}

export interface GroupReactionEntity {
  id: string;
  commitment_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface GroupFeedbackMessageEntity {
  id: string;
  commitment_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_display_name?: string;
}

export interface GroupCommitmentEntity {
  id: string;
  group_id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD
  content: string;
  target_count: number | null;
  completed_count: number;
  status: CommitmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_display_name?: string;
  reactions?: GroupReactionEntity[];
  feedback_messages?: GroupFeedbackMessageEntity[];
}

export interface GroupMeetupEntity {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  notes: string | null;
  revision: number;
  revision_note: string | null;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
  rsvps?: GroupMeetupRSVPEntity[];
  creator_display_name?: string;
}

export interface GroupMeetupRSVPEntity {
  id: string;
  meetup_id: string;
  user_id: string;
  status: RSVPStatus;
  acknowledged_revision: number;
  created_at: string;
  updated_at: string;
  user_display_name?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  timezone?: string;
}

export interface CreateCommitmentInput {
  group_id: string;
  week_start: string;
  content: string;
  target_count?: number | null;
  completed_count?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

export interface UpdateCommitmentInput {
  content?: string;
  target_count?: number | null;
  completed_count?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

export interface CreateMeetupInput {
  group_id: string;
  title: string;
  scheduled_at: string;
  location?: string | null;
  notes?: string | null;
}

export interface UpdateMeetupInput {
  meetup_id: string;
  title: string;
  scheduled_at: string;
  location?: string | null;
  notes?: string | null;
  revision_note?: string | null;
}

// -----------------------------------------------------------------------------
// NHÃN & BIỂU TƯỢNG TIẾNG VIỆT
// -----------------------------------------------------------------------------

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  planned: 'Dự định',
  completed: 'Đã hoàn thành',
  rescheduled: 'Dời lịch',
  needs_companion: 'Cần đồng hành',
};

export const REACTION_SYMBOLS: Record<ReactionType, string> = {
  clap: '👏',
  fire: '🔥',
  muscle: '💪',
  heart: '❤️',
};

export const RSVP_STATUS_LABELS: Record<RSVPStatus, string> = {
  going: 'Tham gia',
  maybe: 'Có thể',
  declined: 'Không tham gia',
};

// -----------------------------------------------------------------------------
// HÀM KIỂM TRA TÍNH HỢP LỆ (VALIDATION)
// -----------------------------------------------------------------------------

export function validateCreateGroupInput(input: Partial<CreateGroupInput>): {
  is_valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = 'Tên nhóm phải có ít nhất 2 ký tự.';
  } else if (input.name.trim().length > 60) {
    errors.name = 'Tên nhóm không được vượt quá 60 ký tự.';
  }

  if (input.description && input.description.length > 300) {
    errors.description = 'Mô tả nhóm không được vượt quá 300 ký tự.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCommitmentInput(input: Partial<CreateCommitmentInput>): {
  is_valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.content || input.content.trim().length < 3) {
    errors.content = 'Nội dung cam kết phải có ít nhất 3 ký tự.';
  } else if (input.content.trim().length > 500) {
    errors.content = 'Nội dung cam kết không được vượt quá 500 ký tự.';
  }

  if (input.target_count !== undefined && input.target_count !== null) {
    if (!Number.isInteger(input.target_count) || input.target_count < 1 || input.target_count > 50) {
      errors.target_count = 'Mục tiêu số lần phải là số nguyên từ 1 đến 50.';
    }
  }

  if (input.completed_count !== undefined) {
    if (!Number.isInteger(input.completed_count) || input.completed_count < 0 || input.completed_count > 50) {
      errors.completed_count = 'Số lần đã thực hiện phải là số nguyên từ 0 đến 50.';
    }
  }

  if (!input.week_start || !/^\d{4}-\d{2}-\d{2}$/.test(input.week_start)) {
    errors.week_start = 'Ngày bắt đầu tuần không đúng định dạng YYYY-MM-DD.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateFeedbackMessageInput(message: string): {
  is_valid: boolean;
  error?: string;
} {
  const trimmed = message.trim();
  if (trimmed.length < 1) {
    return { is_valid: false, error: 'Tin nhắn động viên không được để trống.' };
  }
  if (trimmed.length > 280) {
    return { is_valid: false, error: 'Tin nhắn động viên không được vượt quá 280 ký tự.' };
  }
  return { is_valid: true };
}

export function validateMeetupInput(input: Partial<CreateMeetupInput>): {
  is_valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.title || input.title.trim().length < 3) {
    errors.title = 'Tiêu đề buổi hẹn phải có ít nhất 3 ký tự.';
  } else if (input.title.trim().length > 100) {
    errors.title = 'Tiêu đề buổi hẹn không được vượt quá 100 ký tự.';
  }

  if (!input.scheduled_at || isNaN(Date.parse(input.scheduled_at))) {
    errors.scheduled_at = 'Thời gian hẹn không hợp lệ.';
  }

  if (input.location && input.location.length > 200) {
    errors.location = 'Địa điểm không được vượt quá 200 ký tự.';
  }

  if (input.notes && input.notes.length > 500) {
    errors.notes = 'Ghi chú không được vượt quá 500 ký tự.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}

// -----------------------------------------------------------------------------
// DEEP LINKS & XUẤT TÓM TẮT TUẦN (THEO HỢP ĐỒNG G0)
// -----------------------------------------------------------------------------

export function getGroupDeepLink(groupId: string, tab?: 'commitments' | 'meetups' | 'members'): string {
  if (!tab) return `/groups/${groupId}`;
  return `/groups/${groupId}?tab=${tab}`;
}

export function getInviteDeepLink(token: string): string {
  return `/groups/invite/${token}`;
}

export interface GroupWeekSummaryExport {
  group_id: string;
  group_name: string;
  week_start: string;
  member_count: number;
  total_commitments: number;
  completed_commitments: number;
  in_progress_commitments: number;
  needs_companion_commitments: number;
  items: Array<{
    display_name: string;
    content: string;
    status: CommitmentStatus;
    status_label: string;
    progress_label: string;
  }>;
  summary_text: string;
}

/**
 * Xuất tóm tắt cam kết tuần của nhóm theo đúng hợp đồng CONTRACTS.
 * Tuyệt đối không chứa hồ sơ y tế, chỉ số sức khỏe hay nhật ký cá nhân.
 */
export function exportGroupWeekSummary(
  group: Pick<GroupEntity, 'id' | 'name' | 'timezone'>,
  commitments: GroupCommitmentEntity[],
  weekStart: string,
  membersCount: number
): GroupWeekSummaryExport {
  let completed = 0;
  let inProgress = 0;
  let needsCompanion = 0;

  const items = commitments.map((c) => {
    if (c.status === 'completed') completed++;
    else if (c.status === 'needs_companion') needsCompanion++;
    else inProgress++;

    const progressLabel =
      c.target_count !== null && c.target_count !== undefined
        ? `${c.completed_count}/${c.target_count} lần`
        : c.completed_count > 0
        ? `${c.completed_count} lần`
        : 'Chưa cập nhật tiến độ';

    return {
      display_name: c.user_display_name || 'Thành viên',
      content: c.content,
      status: c.status,
      status_label: COMMITMENT_STATUS_LABELS[c.status] || c.status,
      progress_label: progressLabel,
    };
  });

  const lines = [
    `📊 Tóm tắt cam kết nhóm "${group.name}"`,
    `Tuần bắt đầu: ${weekStart} (Múi giờ: ${group.timezone})`,
    `Số thành viên: ${membersCount}/5`,
    `Tổng cam kết: ${commitments.length} | Hoàn thành: ${completed} | Cần đồng hành: ${needsCompanion}`,
    '',
    ...items.map(
      (item, idx) =>
        `${idx + 1}. [${item.display_name}] ${item.content} — ${item.status_label} (${item.progress_label})`
    ),
  ];

  return {
    group_id: group.id,
    group_name: group.name,
    week_start: weekStart,
    member_count: membersCount,
    total_commitments: commitments.length,
    completed_commitments: completed,
    in_progress_commitments: inProgress,
    needs_companion_commitments: needsCompanion,
    items,
    summary_text: lines.join('\n'),
  };
}
