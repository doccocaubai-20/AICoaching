/**
 * CALISCOACHING - AGENT D DATABASE TYPES FRAGMENT
 * Version: 20261028000001
 * Bảng và RPC phục vụ nhóm nhỏ cùng giữ cam kết (D5 - Contract G0):
 * - groups
 * - group_members
 * - group_invites
 * - group_commitments
 * - group_reactions
 * - group_feedback_messages
 * - group_meetups
 * - group_meetup_rsvps
 * - group_rate_limits
 */

import {
  GroupRole,
  GroupStatus,
  MemberStatus,
  CommitmentStatus,
  ReactionType,
  RSVPStatus,
} from './group.contract';

export interface AgentDDatabaseTypes {
  groups: {
    Row: {
      id: string;
      name: string;
      description: string | null;
      timezone: string;
      created_by: string;
      status: GroupStatus;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      name: string;
      description?: string | null;
      timezone?: string;
      created_by: string;
      status?: GroupStatus;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      name?: string;
      description?: string | null;
      timezone?: string;
      created_by?: string;
      status?: GroupStatus;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  group_members: {
    Row: {
      id: string;
      group_id: string;
      user_id: string;
      role: GroupRole;
      status: MemberStatus;
      is_muted: boolean;
      joined_at: string;
      left_at: string | null;
    };
    Insert: {
      id?: string;
      group_id: string;
      user_id: string;
      role?: GroupRole;
      status?: MemberStatus;
      is_muted?: boolean;
      joined_at?: string;
      left_at?: string | null;
    };
    Update: {
      id?: string;
      group_id?: string;
      user_id?: string;
      role?: GroupRole;
      status?: MemberStatus;
      is_muted?: boolean;
      joined_at?: string;
      left_at?: string | null;
    };
    Relationships: [];
  };
  group_invites: {
    Row: {
      id: string;
      group_id: string;
      token_hash: string;
      created_by: string;
      expires_at: string;
      max_uses: number;
      used_count: number;
      is_revoked: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      group_id: string;
      token_hash: string;
      created_by: string;
      expires_at: string;
      max_uses?: number;
      used_count?: number;
      is_revoked?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      group_id?: string;
      token_hash?: string;
      created_by?: string;
      expires_at?: string;
      max_uses?: number;
      used_count?: number;
      is_revoked?: boolean;
      created_at?: string;
    };
    Relationships: [];
  };
  group_commitments: {
    Row: {
      id: string;
      group_id: string;
      user_id: string;
      week_start: string;
      content: string;
      target_count: number | null;
      completed_count: number;
      status: CommitmentStatus;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      group_id: string;
      user_id: string;
      week_start: string;
      content: string;
      target_count?: number | null;
      completed_count?: number;
      status?: CommitmentStatus;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      group_id?: string;
      user_id?: string;
      week_start?: string;
      content?: string;
      target_count?: number | null;
      completed_count?: number;
      status?: CommitmentStatus;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  group_reactions: {
    Row: {
      id: string;
      commitment_id: string;
      user_id: string;
      reaction_type: ReactionType;
      created_at: string;
    };
    Insert: {
      id?: string;
      commitment_id: string;
      user_id: string;
      reaction_type: ReactionType;
      created_at?: string;
    };
    Update: {
      id?: string;
      commitment_id?: string;
      user_id?: string;
      reaction_type?: ReactionType;
      created_at?: string;
    };
    Relationships: [];
  };
  group_feedback_messages: {
    Row: {
      id: string;
      commitment_id: string;
      user_id: string;
      message: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      commitment_id: string;
      user_id: string;
      message: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      commitment_id?: string;
      user_id?: string;
      message?: string;
      created_at?: string;
    };
    Relationships: [];
  };
  group_meetups: {
    Row: {
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
    };
    Insert: {
      id?: string;
      group_id: string;
      created_by: string;
      title: string;
      scheduled_at: string;
      location?: string | null;
      notes?: string | null;
      revision?: number;
      revision_note?: string | null;
      last_modified_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      group_id?: string;
      created_by?: string;
      title?: string;
      scheduled_at?: string;
      location?: string | null;
      notes?: string | null;
      revision?: number;
      revision_note?: string | null;
      last_modified_by?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  group_meetup_rsvps: {
    Row: {
      id: string;
      meetup_id: string;
      user_id: string;
      status: RSVPStatus;
      acknowledged_revision: number;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      meetup_id: string;
      user_id: string;
      status: RSVPStatus;
      acknowledged_revision?: number;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      meetup_id?: string;
      user_id?: string;
      status?: RSVPStatus;
      acknowledged_revision?: number;
      created_at?: string;
      updated_at?: string;
    };
    Relationships: [];
  };
  group_rate_limits: {
    Row: {
      id: string;
      user_id: string;
      action_type: string;
      created_at: string;
    };
    Insert: {
      id?: string;
      user_id: string;
      action_type: string;
      created_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string;
      action_type?: string;
      created_at?: string;
    };
    Relationships: [];
  };
}

export interface AgentDFunctionTypes {
  create_group_with_owner: {
    Args: {
      p_name: string;
      p_description: string | null;
      p_timezone: string;
    };
    Returns: string;
  };
  create_group_invite: {
    Args: {
      p_group_id: string;
      p_token_hash: string;
      p_expires_at: string;
      p_max_uses?: number;
    };
    Returns: string;
  };
  get_group_invite_preview: {
    Args: {
      p_token_hash: string;
    };
    Returns: Array<{
      group_id: string | null;
      group_name: string;
      group_description: string | null;
      group_timezone: string;
      member_count: number;
      inviter_display_name: string;
      expires_at: string;
      is_valid: boolean;
      invalid_reason: string | null;
    }>;
  };
  accept_group_invite: {
    Args: {
      p_token_hash: string;
    };
    Returns: string;
  };
  leave_group: {
    Args: {
      p_group_id: string;
    };
    Returns: boolean;
  };
  transfer_group_ownership: {
    Args: {
      p_group_id: string;
      p_new_owner_id: string;
    };
    Returns: boolean;
  };
  archive_group: {
    Args: {
      p_group_id: string;
    };
    Returns: boolean;
  };
  get_group_member_profiles: {
    Args: {
      p_group_id: string;
    };
    Returns: Array<{
      user_id: string;
      display_name: string;
      role: string;
      status: string;
      is_muted: boolean;
      joined_at: string;
    }>;
  };
  update_group_meetup: {
    Args: {
      p_meetup_id: string;
      p_title: string;
      p_scheduled_at: string;
      p_location: string | null;
      p_notes: string | null;
      p_revision_note: string | null;
    };
    Returns: number;
  };
}
