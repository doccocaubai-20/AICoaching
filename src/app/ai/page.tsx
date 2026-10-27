import React from 'react';
import { BotMessageSquare, Sparkles } from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { AIManager } from '@/components/ai/AIManager';
import { getAIEnvConfig } from '@/lib/ai/env';
import {
  AIConsentEntity,
  AISummaryEntity,
  AIConversationEntity,
  AIMessageEntity,
} from '@/contracts';

export const metadata = {
  title: 'Trợ lý AI | CalisCoaching',
  description: 'Tóm tắt quá trình rèn luyện và hỏi đáp theo nhật ký có trích dẫn nguồn minh bạch',
};

export default async function AIPage() {
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.isConfigured) {
    return (
      <div className="p-4 space-y-4">
        <CredentialStatusBanner
          isConfigured={envStatus.isConfigured}
          missingKeys={envStatus.missingKeys}
        />
        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-500">
            Hệ thống cơ sở dữ liệu Supabase chưa được cấu hình. Vui lòng thiết lập biến môi trường để
            sử dụng tính năng AI.
          </p>
        </div>
      </div>
    );
  }

  const { user } = await getAuthenticatedUser();

  if (!user) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BotMessageSquare className="w-5 h-5 text-purple-600" />
            <span>Trợ lý AI theo hồ sơ</span>
          </h1>
          <p className="text-xs text-slate-500">
            Tóm tắt quá trình và hỏi đáp dựa trên dữ liệu nhật ký có trích dẫn nguồn
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Vui lòng đăng nhập để kích hoạt trợ lý AI và xem phân tích nhật ký của bạn.
          </p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Đăng nhập ngay
          </a>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  let consent: AIConsentEntity | null = null;
  let latestSummary: AISummaryEntity | null = null;
  let latestTrend: AISummaryEntity | null = null;
  let activeConversation: AIConversationEntity | null = null;
  let messages: AIMessageEntity[] = [];
  let latestActivityAt: string | null = null;
  let loadError: string | null = null;

  if (supabase) {
    // 1. Lấy trạng thái Consent
    const consentRes = await supabase
      .from('ai_consents')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    consent = consentRes.data as unknown as AIConsentEntity | null;

    // 2. Lấy riêng bản tóm tắt hồ sơ và bản phân tích xu hướng mới nhất
    const [summaryRes, trendRes] = await Promise.all([
      supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', user.id)
        .or('input_scope->>kind.is.null,input_scope->>kind.neq.analysis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('input_scope->>kind', 'analysis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    latestSummary = summaryRes.data as unknown as AISummaryEntity | null;
    latestTrend = trendRes.data as unknown as AISummaryEntity | null;

    // 3. Lấy thời điểm hoạt động mới nhất
    const actRes = await supabase
      .from('activities')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (actRes.data?.created_at) {
      latestActivityAt = actRes.data.created_at;
    }

    // 4. Lấy cuộc trò chuyện gần nhất và tin nhắn
    const convRes = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    activeConversation = convRes.data as unknown as AIConversationEntity | null;

    let msgError = false;
    if (activeConversation) {
      const msgRes = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', activeConversation.id)
        .order('created_at', { ascending: true });

      if (msgRes.error) {
        msgError = true;
      } else {
        messages = (msgRes.data || []) as unknown as AIMessageEntity[];
      }
    }

    if (
      consentRes.error ||
      summaryRes.error ||
      trendRes.error ||
      actRes.error ||
      convRes.error ||
      msgError
    ) {
      loadError = 'Không thể tải toàn bộ dữ liệu AI từ máy chủ. Vui lòng thử tải lại trang.';
    }
  }

  const aiConfig = getAIEnvConfig();
  const providerLabel =
    aiConfig.provider === 'google'
      ? `Google Gemini (${aiConfig.modelName})`
      : 'Google Gemini (Chưa thiết lập khóa)';

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BotMessageSquare className="w-5 h-5 text-purple-600" />
          <span>Trợ lý AI theo hồ sơ</span>
        </h1>
        <p className="text-xs text-slate-500">
          Tóm tắt quá trình và hỏi đáp dựa trên dữ liệu nhật ký có trích dẫn nguồn
        </p>
      </div>

      <AIManager
        consent={consent}
        latestSummary={latestSummary}
        latestTrend={latestTrend}
        activeConversation={activeConversation}
        messages={messages}
        latestActivityAt={latestActivityAt}
        providerName={providerLabel}
        isAIConfigured={aiConfig.isConfigured}
        loadError={loadError}
      />
    </div>
  );
}
