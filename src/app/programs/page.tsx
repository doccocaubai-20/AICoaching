import React from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ProgramsManager } from '@/components/programs/ProgramsManager';
import {
  ProgramEntity,
  SessionEntity,
  SessionResultEntity,
  ReviewSuggestionEntity,
} from '@/contracts';

export default async function ProgramsPage() {
  const envStatus = getSupabaseEnvStatus();

  // 1. Khi chưa cấu hình credentials: Chế độ Standalone độc lập
  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner
          isConfigured={false}
          missingKeys={envStatus.missingKeys}
        />
        <ProgramsManager
          program={null}
          sessions={[]}
          sessionResults={[]}
          suggestions={[]}
          isConfigured={false}
        />
      </div>
    );
  }

  // 2. Xác thực phiên đăng nhập
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login');
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect('/login');
  }

  // 3. Tải song song chương trình, buổi tập hệ thống, kết quả của người dùng và các gợi ý
  const [
    programRes,
    sessionsRes,
    resultsRes,
    suggestionsRes,
  ] = await Promise.all([
    supabase.from('programs').select('*').limit(1).maybeSingle(),
    supabase.from('sessions').select('*').order('sequence_order', { ascending: true }),
    supabase
      .from('session_results')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false }),
    supabase
      .from('review_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const program = (programRes.data as ProgramEntity) || null;
  const sessions = (sessionsRes.data as SessionEntity[]) || [];
  const sessionResults = (resultsRes.data as SessionResultEntity[]) || [];
  const suggestions = (suggestionsRes.data as ReviewSuggestionEntity[]) || [];

  return (
    <div className="p-4 space-y-4">
      <ProgramsManager
        program={program}
        sessions={sessions}
        sessionResults={sessionResults}
        suggestions={suggestions}
        isConfigured={true}
        programError={
          programRes.error ? 'Không tải được thông tin chương trình tập.' : null
        }
        sessionsError={
          sessionsRes.error ? 'Không tải được danh sách buổi tập.' : null
        }
        resultsError={
          resultsRes.error ? 'Không tải được lịch sử kết quả buổi tập.' : null
        }
        suggestionsError={
          suggestionsRes.error ? 'Không tải được gợi ý xem lại lịch.' : null
        }
      />
    </div>
  );
}
