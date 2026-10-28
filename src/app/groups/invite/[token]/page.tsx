import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { getInvitePreviewAction } from '@/app/groups/actions';
import { GroupInvitePreviewCard } from '@/components/groups/GroupInvitePreviewCard';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: 'Lời mời gia nhập nhóm | CalisCoaching',
  description: 'Xem trước thông tin lời mời và tham gia nhóm cùng giữ cam kết.',
};

export default async function GroupInvitePage({ params }: PageProps) {
  const { token } = await params;
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
          Chưa cấu hình Supabase credentials.
        </div>
      </div>
    );
  }

  // 1. Kiểm tra trạng thái đăng nhập
  const { user } = await getAuthenticatedUser();
  const isLoggedIn = Boolean(user);

  // 2. Lấy thông tin xem trước lời mời (GET Preview an toàn)
  const previewRes = await getInvitePreviewAction(token);
  const preview = previewRes.data || {
    group_id: null,
    group_name: '',
    group_description: null,
    group_timezone: 'Asia/Ho_Chi_Minh',
    member_count: 0,
    inviter_display_name: '',
    expires_at: '',
    is_valid: false,
    invalid_reason: previewRes.message || 'Lời mời không hợp lệ.',
  };

  // 3. Nếu đã đăng nhập và đã là thành viên của nhóm này, tự động chuyển vào trang nhóm
  if (isLoggedIn && user && preview.group_id) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: member } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', preview.group_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (member) {
        redirect(`/groups/${preview.group_id}`);
      }
    }
  }

  return (
    <div className="p-4 min-h-[70vh] flex items-center justify-center pb-24">
      <GroupInvitePreviewCard
        preview={preview}
        rawToken={token}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
