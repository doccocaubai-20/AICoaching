'use client';

/**
 * CALISCOACHING MVP - QUẢN LÝ TƯƠNG TÁC AI TOÀN DIỆN (AGENT E)
 * Điều phối các khối Đồng ý (Consent), Tóm tắt hồ sơ (Summary),
 * Phân tích xu hướng (Trend Analysis P1) và Hỏi đáp (Chat Box).
 */

import React from 'react';
import { BotMessageSquare, Sparkles, Info, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  AIConsentEntity,
  AISummaryEntity,
  AIConversationEntity,
  AIMessageEntity,
  CURRENT_CONSENT_VERSION,
} from '@/contracts';
import { AIConsentBanner } from './AIConsentBanner';
import { AISummaryCard } from './AISummaryCard';
import { AITrendCard } from './AITrendCard';
import { AIChatBox } from './AIChatBox';

interface AIManagerProps {
  consent: AIConsentEntity | null;
  latestSummary: AISummaryEntity | null;
  latestTrend: AISummaryEntity | null;
  activeConversation: AIConversationEntity | null;
  messages: AIMessageEntity[];
  latestActivityAt: string | null;
  providerName: string;
  isAIConfigured: boolean;
  loadError?: string | null;
}

export function AIManager({
  consent,
  latestSummary,
  latestTrend,
  activeConversation,
  messages,
  latestActivityAt,
  providerName,
  isAIConfigured,
  loadError,
}: AIManagerProps) {
  const hasConsent = Boolean(
    consent?.is_granted && !consent?.revoked_at && consent?.consent_version === CURRENT_CONSENT_VERSION
  );

  return (
    <div className="space-y-4">
      {/* Thông báo lỗi tải dữ liệu từ máy chủ */}
      {loadError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-900 dark:text-red-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Lỗi truy vấn dữ liệu AI:</span>
            <p className="text-[11px] text-red-800/80 dark:text-red-300/80 mt-0.5">
              {loadError}
            </p>
          </div>
        </div>
      )}

      {/* Thông báo trạng thái cấu hình AI */}
      {!isAIConfigured && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Môi trường chưa kích hoạt khóa API AI:</span>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Hệ thống sẽ tự động kích hoạt tính năng tổng hợp theo mẫu thuần (TypeScript) có nhãn{' '}
              <strong>&ldquo;Mẫu tổng hợp (Không dùng AI)&rdquo;</strong> để bạn vẫn có thể xem số
              liệu rèn luyện đầy đủ.
            </p>
          </div>
        </div>
      )}

      {/* 1. Quản lý đồng ý dữ liệu */}
      <AIConsentBanner consent={consent} providerName={providerName} />

      {/* 2. Tóm tắt hồ sơ (P0) */}
      <AISummaryCard
        summary={latestSummary}
        hasConsent={hasConsent}
        latestActivityAt={latestActivityAt}
        loadError={loadError}
      />

      {/* 3. Phân tích xu hướng (P1) */}
      <AITrendCard
        trendSummary={latestTrend}
        hasConsent={hasConsent}
        loadError={loadError}
      />

      {/* 4. Hỏi đáp theo hồ sơ (P0) */}
      <AIChatBox
        activeConversation={activeConversation}
        messages={messages}
        hasConsent={hasConsent}
      />
    </div>
  );
}
