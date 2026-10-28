'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  CreateGroupInput,
  validateCreateGroupInput,
  CreateCommitmentInput,
  validateCommitmentInput,
  CommitmentStatus,
  ReactionType,
  validateFeedbackMessageInput,
  CreateMeetupInput,
  validateMeetupInput,
  UpdateMeetupInput,
  RSVPStatus,
  GroupInvitePreview,
} from '@/contracts/group.contract';
import { Database } from '@/contracts/database.types';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

/**
 * 1. TẠO NHÓM MỚI (1-5 người)
 */
export async function createGroupAction(input: CreateGroupInput): Promise<ActionResult<{ groupId: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const val = validateCreateGroupInput(input);
    if (!val.is_valid) {
      return { success: false, errors: val.errors, message: 'Thông tin nhóm không hợp lệ.' };
    }

    const { data: groupId, error } = await supabase.rpc('create_group_with_owner', {
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_timezone: input.timezone?.trim() || 'Asia/Ho_Chi_Minh',
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể tạo nhóm. Vui lòng thử lại.' };
    }

    revalidatePath('/groups');
    return { success: true, data: { groupId }, message: 'Tạo nhóm thành công!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi hệ thống khi tạo nhóm.';
    return { success: false, message: msg };
  }
}

/**
 * 2. TẠO LỜI MỜI NHÓM (TOKEN NGẪU NHIÊN, LƯU HASH, TTL, GIỚI HẠN DÙNG)
 * Không đưa URL/token vào log hoặc analytics.
 */
export async function createInviteAction(
  groupId: string,
  maxUses: number = 1,
  ttlHours: number = 168 // 7 ngày
): Promise<ActionResult<{ rawToken: string; expiresAt: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    if (!groupId) {
      return { success: false, message: 'ID nhóm không hợp lệ.' };
    }

    // Sinh token ngẫu nhiên an toàn 24 bytes (base64url)
    const rawToken = crypto.randomBytes(24).toString('base64url');
    // Tính hash SHA-256 để lưu DB
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + Math.max(1, ttlHours) * 3600 * 1000).toISOString();

    const { error } = await supabase.rpc('create_group_invite', {
      p_group_id: groupId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_max_uses: Math.min(Math.max(1, maxUses), 10),
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể tạo lời mời.' };
    }

    revalidatePath(`/groups/${groupId}`);
    // Chỉ trả token về cho giao diện copy, không log ra server log/analytics
    return {
      success: true,
      data: { rawToken, expiresAt },
      message: 'Tạo liên kết mời thành công!',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi tạo lời mời.';
    return { success: false, message: msg };
  }
}

/**
 * 3. XEM TRƯỚC LỜI MỜI (GET PREVIEW - AN TOÀN, KHÔNG GIA NHẬP)
 */
export async function getInvitePreviewAction(rawToken: string): Promise<ActionResult<GroupInvitePreview>> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    if (!rawToken || rawToken.trim().length < 8) {
      return {
        success: false,
        data: {
          group_id: null,
          group_name: '',
          group_description: null,
          group_timezone: '',
          member_count: 0,
          inviter_display_name: '',
          expires_at: '',
          is_valid: false,
          invalid_reason: 'Mã lời mời không hợp lệ.',
        },
      };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const { data, error } = await supabase.rpc('get_group_invite_preview', {
      p_token_hash: tokenHash,
    });

    if (error || !data || data.length === 0) {
      return {
        success: false,
        message: error?.message || 'Không tìm thấy thông tin lời mời.',
      };
    }

    const row = data[0];
    return {
      success: true,
      data: {
        group_id: row.group_id,
        group_name: row.group_name,
        group_description: row.group_description,
        group_timezone: row.group_timezone,
        member_count: Number(row.member_count),
        inviter_display_name: row.inviter_display_name,
        expires_at: row.expires_at,
        is_valid: Boolean(row.is_valid),
        invalid_reason: row.invalid_reason,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xem trước lời mời.';
    return { success: false, message: msg };
  }
}

/**
 * 4. CHẤP NHẬN LỜI MỜI GIA NHẬP (MUTATION VỚI GIAO DỊCH KHÓA)
 */
export async function acceptInviteAction(rawToken: string): Promise<ActionResult<{ groupId: string }>> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    if (!rawToken || rawToken.trim().length < 8) {
      return { success: false, message: 'Mã lời mời không hợp lệ.' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const { data: groupId, error } = await supabase.rpc('accept_group_invite', {
      p_token_hash: tokenHash,
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể gia nhập nhóm.' };
    }

    revalidatePath('/groups');
    revalidatePath(`/groups/${groupId}`);
    return { success: true, data: { groupId }, message: 'Gia nhập nhóm thành công!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi chấp nhận lời mời.';
    return { success: false, message: msg };
  }
}

/**
 * 5. RỜI NHÓM (LEAVE GROUP)
 */
export async function leaveGroupAction(groupId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
    if (error) {
      return { success: false, message: error.message || 'Không thể rời nhóm.' };
    }

    revalidatePath('/groups');
    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Đã rời nhóm thành công.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi rời nhóm.';
    return { success: false, message: msg };
  }
}

/**
 * 6. CHUYỂN QUYỀN CHỦ NHÓM (TRANSFER OWNERSHIP)
 */
export async function transferOwnershipAction(groupId: string, newOwnerId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const { error } = await supabase.rpc('transfer_group_ownership', {
      p_group_id: groupId,
      p_new_owner_id: newOwnerId,
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể chuyển quyền chủ nhóm.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Chuyển quyền chủ nhóm thành công!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi chuyển quyền.';
    return { success: false, message: msg };
  }
}

/**
 * 7. LƯU TRỮ/GIẢI TÁN NHÓM (ARCHIVE GROUP)
 */
export async function archiveGroupAction(groupId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const { error } = await supabase.rpc('archive_group', { p_group_id: groupId });
    if (error) {
      return { success: false, message: error.message || 'Không thể giải tán nhóm.' };
    }

    revalidatePath('/groups');
    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Nhóm đã được lưu trữ/giải tán.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi giải tán nhóm.';
    return { success: false, message: msg };
  }
}

/**
 * 8. BẬT/TẮT MUTE THÔNG BÁO NHÓM
 */
export async function toggleGroupMuteAction(groupId: string, isMuted: boolean): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const { error } = await supabase
      .from('group_members')
      .update({ is_muted: isMuted })
      .eq('group_id', groupId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: error.message || 'Không thể cập nhật thông báo.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: isMuted ? 'Đã tắt thông báo nhóm.' : 'Đã bật thông báo nhóm.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật mute.';
    return { success: false, message: msg };
  }
}

/**
 * 9. LƯU CAM KẾT TUẦN (TẠO HOẶC CẬP NHẬT)
 */
export async function saveCommitmentAction(input: CreateCommitmentInput): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const val = validateCommitmentInput(input);
    if (!val.is_valid) {
      return { success: false, errors: val.errors, message: 'Dữ liệu cam kết chưa đúng.' };
    }

    const { error } = await supabase.from('group_commitments').upsert(
      {
        group_id: input.group_id,
        user_id: user.id,
        week_start: input.week_start,
        content: input.content.trim(),
        target_count: input.target_count ?? null,
        completed_count: input.completed_count ?? 0,
        status: input.status ?? 'planned',
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,user_id,week_start' }
    );

    if (error) {
      return { success: false, message: error.message || 'Không thể lưu cam kết tuần.' };
    }

    revalidatePath(`/groups/${input.group_id}`);
    return { success: true, message: 'Đã lưu cam kết tuần!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi lưu cam kết.';
    return { success: false, message: msg };
  }
}

/**
 * 10. CẬP NHẬT TRẠNG THÁI VÀ TIẾN ĐỘ CAM KẾT (DỰ ĐỊNH / ĐÃ LÀM / DỜI LỊCH / CẦN ĐỒNG HÀNH)
 */
export async function updateCommitmentStatusAction(
  commitmentId: string,
  groupId: string,
  status: CommitmentStatus,
  completedCount?: number
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const updatePayload: Database['public']['Tables']['group_commitments']['Update'] = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (completedCount !== undefined && Number.isInteger(completedCount)) {
      updatePayload.completed_count = Math.max(0, completedCount);
    }

    const { error } = await supabase
      .from('group_commitments')
      .update(updatePayload)
      .eq('id', commitmentId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, message: error.message || 'Không thể cập nhật trạng thái.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Đã cập nhật trạng thái cam kết!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái.';
    return { success: false, message: msg };
  }
}

/**
 * 11. THẢ / GỠ PHẢN HỒI (REACTION: CLAP, FIRE, MUSCLE, HEART)
 */
export async function toggleReactionAction(
  commitmentId: string,
  groupId: string,
  reactionType: ReactionType
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    // Kiểm tra xem đã thả reaction này chưa
    const { data: existing } = await supabase
      .from('group_reactions')
      .select('id')
      .eq('commitment_id', commitmentId)
      .eq('user_id', user.id)
      .eq('reaction_type', reactionType)
      .maybeSingle();

    if (existing) {
      await supabase.from('group_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('group_reactions').insert({
        commitment_id: commitmentId,
        user_id: user.id,
        reaction_type: reactionType,
      });
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi phản hồi.';
    return { success: false, message: msg };
  }
}

/**
 * 12. GỬI TIN NHẮN ĐỘNG VIÊN NGẮN (MAX 280 KÝ TỰ, RENDER TEXT AN TOÀN)
 */
export async function addFeedbackMessageAction(
  commitmentId: string,
  groupId: string,
  message: string
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const val = validateFeedbackMessageInput(message);
    if (!val.is_valid) {
      return { success: false, message: val.error || 'Nội dung tin nhắn không hợp lệ.' };
    }

    const cleanMessage = message.trim().slice(0, 280).replace(/[<>]/g, '');

    const { error } = await supabase.from('group_feedback_messages').insert({
      commitment_id: commitmentId,
      user_id: user.id,
      message: cleanMessage,
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể gửi tin nhắn động viên.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Đã gửi lời động viên!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi gửi tin nhắn.';
    return { success: false, message: msg };
  }
}

/**
 * 13. TẠO BUỔI HẸN CHUNG (MEETUP)
 */
export async function createMeetupAction(input: CreateMeetupInput): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const val = validateMeetupInput(input);
    if (!val.is_valid) {
      return { success: false, errors: val.errors, message: 'Thông tin buổi hẹn chưa đúng.' };
    }

    const { data: meetup, error } = await supabase
      .from('group_meetups')
      .insert({
        group_id: input.group_id,
        created_by: user.id,
        title: input.title.trim(),
        scheduled_at: input.scheduled_at,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
        revision: 1,
      })
      .select('id')
      .single();

    if (error || !meetup) {
      return { success: false, message: error?.message || 'Không thể tạo buổi hẹn.' };
    }

    // Tự động thêm RSVP 'going' cho người tạo
    await supabase.from('group_meetup_rsvps').insert({
      meetup_id: meetup.id,
      user_id: user.id,
      status: 'going',
      acknowledged_revision: 1,
    });

    revalidatePath(`/groups/${input.group_id}`);
    return { success: true, message: 'Đã lên lịch hẹn buổi tập chung!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi tạo buổi hẹn.';
    return { success: false, message: msg };
  }
}

/**
 * 14. CẬP NHẬT LỊCH HẸN VỚI TỰ ĐỘNG TĂNG REVISION
 */
export async function updateMeetupAction(input: UpdateMeetupInput, groupId: string): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const val = validateMeetupInput(input);
    if (!val.is_valid) {
      return { success: false, errors: val.errors, message: 'Thông tin buổi hẹn chưa đúng.' };
    }

    const { data: newRevision, error } = await supabase.rpc('update_group_meetup', {
      p_meetup_id: input.meetup_id,
      p_title: input.title.trim(),
      p_scheduled_at: input.scheduled_at,
      p_location: input.location?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_revision_note: input.revision_note?.trim() || 'Cập nhật thời gian hoặc địa điểm',
    });

    if (error) {
      return { success: false, message: error.message || 'Không thể cập nhật buổi hẹn.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: `Lịch hẹn đã được cập nhật (Phiên bản ${newRevision})!` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật buổi hẹn.';
    return { success: false, message: msg };
  }
}

/**
 * 15. RSVP / XÁC NHẬN THAM GIA BUỔI HẸN
 */
export async function rsvpMeetupAction(
  meetupId: string,
  groupId: string,
  status: RSVPStatus,
  currentRevision: number
): Promise<ActionResult> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, message: 'Chưa kết nối cơ sở dữ liệu Supabase.' };
    }

    const { error } = await supabase.from('group_meetup_rsvps').upsert(
      {
        meetup_id: meetupId,
        user_id: user.id,
        status,
        acknowledged_revision: currentRevision,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'meetup_id,user_id' }
    );

    if (error) {
      return { success: false, message: error.message || 'Không thể phản hồi tham gia.' };
    }

    revalidatePath(`/groups/${groupId}`);
    return { success: true, message: 'Đã cập nhật phản hồi tham gia!' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi RSVP.';
    return { success: false, message: msg };
  }
}
