/**
 * CALISCOACHING MVP - ĐỊNH NGHĨA KIỂU DỮ LIỆU MODULE AI (AGENT E)
 * Giao tiếp thống nhất giữa adapter, prompt, ngữ cảnh và Server Actions.
 */

import {
  AISummaryStatus,
  AIMessageRole,
  AIMessageStatus,
  GoalType,
  GoalStatus,
  ActivityType,
  ActivitySource,
  MetricType,
  ObservationSource,
} from '@/contracts';

export type AIProviderType = 'google' | 'mock';

export interface AIReferenceSourceItem {
  type: 'goal' | 'activity' | 'observation' | 'profile';
  id: string;
  description?: string;
}

export interface AISummaryOutput {
  summary: string;
  period: {
    from: string;
    to: string;
  };
  references: AIReferenceSourceItem[];
  missing_data: string[];
}

export interface AIAnswerOutput {
  answer: string;
  references: AIReferenceSourceItem[];
  period_used: string | null;
  missing_data_acknowledged: boolean;
  out_of_scope: boolean;
}

export interface AIMessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Ngữ cảnh dữ liệu hồ sơ tối giản được gửi tới AI.
 * NGUYÊN TẮC BẢO MẬT: Tuyệt đối KHÔNG chứa email, user_id, hoặc display_name của người dùng.
 */
export interface AIContextPayload {
  profile?: {
    experience_level: string;
    available_equipment: string[];
    schedule_availability: unknown;
  };
  goals: Array<{
    id: string;
    content: string;
    goal_type: GoalType;
    status: GoalStatus;
    start_date: string | null;
    end_date: string | null;
  }>;
  activities: Array<{
    id: string;
    activity_type: ActivityType;
    is_planned: boolean;
    start_at: string;
    duration_minutes: number;
    fatigue_level: number | null;
    notes: string | null;
    source: ActivitySource;
  }>;
  observations: Array<{
    id: string;
    metric_type: MetricType;
    metric_value: number;
    metric_unit: string;
    observed_at: string;
    source: ObservationSource;
  }>;
  review_suggestions?: Array<{
    id: string;
    reason: string;
    reference_activity_ids: string[];
    rule_version: string;
    status: string;
  }>;
  date_window: {
    from: string;
    to: string;
  };
}

/**
 * Số liệu đo lường kỹ thuật (Telemetry).
 * NGUYÊN TẮC: Tuyệt đối KHÔNG log nội dung nhạy cảm, câu hỏi hay ghi chú.
 */
export interface AIMetrics {
  operation: 'summary' | 'answer' | 'trend_analysis';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  stopReason?: string;
  errorCode?: string;
}

export interface AITrendHighlightItem {
  metric_key: string;
  text: string;
  references: AIReferenceSourceItem[];
}

export interface AITrendAnalysisOutput {
  highlights: AITrendHighlightItem[];
  missing_data: string[];
  period: {
    from: string;
    to: string;
    weeks: number;
  };
}

/**
 * Interface cho AI Adapter cho phép đổi nhà cung cấp và mock kiểm thử độc lập.
 */
export interface AIAdapter {
  summarize(context: AIContextPayload): Promise<AISummaryOutput>;
  answer(
    context: AIContextPayload,
    question: string,
    history?: AIMessageHistoryItem[]
  ): Promise<AIAnswerOutput>;
  analyzeTrends?(metrics: unknown): Promise<AITrendAnalysisOutput>;
}
