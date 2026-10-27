/**
 * CALISCOACHING MVP - MOCK AI ADAPTER (AGENT E)
 * Adapter giả lập phục vụ kiểm thử đơn vị, kiểm tra ngoại lệ mạng và phát triển độc lập không cần credential.
 */

import {
  AIAdapter,
  AIContextPayload,
  AISummaryOutput,
  AIAnswerOutput,
  AITrendAnalysisOutput,
  AIMessageHistoryItem,
} from '../types';
import { ProfileMetrics, generateTemplateTrendAnalysis } from '../trend-analysis';

export interface MockAIOptions {
  shouldThrowError?: boolean;
  errorMessage?: string;
  delayMs?: number;
  customSummaryOutput?: Partial<AISummaryOutput>;
  customAnswerOutput?: Partial<AIAnswerOutput>;
  customTrendOutput?: Partial<AITrendAnalysisOutput>;
}

export class MockAIAdapter implements AIAdapter {
  private options: MockAIOptions;

  constructor(options: MockAIOptions = {}) {
    this.options = options;
  }

  setOptions(options: MockAIOptions): void {
    this.options = { ...this.options, ...options };
  }

  async summarize(context: AIContextPayload): Promise<AISummaryOutput> {
    if (this.options.delayMs) {
      await new Promise((res) => setTimeout(res, this.options.delayMs));
    }

    if (this.options.shouldThrowError) {
      throw new Error(this.options.errorMessage || 'MOCK_AI_ERROR: Giả lập lỗi kết nối AI');
    }

    if (this.options.customSummaryOutput) {
      return {
        summary: this.options.customSummaryOutput.summary || 'Tóm tắt mẫu kiểm thử',
        period: this.options.customSummaryOutput.period || {
          from: context.date_window.from,
          to: context.date_window.to,
        },
        references: this.options.customSummaryOutput.references || [],
        missing_data: this.options.customSummaryOutput.missing_data || [],
      };
    }

    const completed = context.activities.filter((a) => !a.is_planned);
    const references = completed.map((a) => ({
      type: 'activity' as const,
      id: a.id,
      description: `Buổi tập ${a.activity_type} (${a.duration_minutes} phút)`,
    }));

    const missingData: string[] = [];
    if (!context.observations.some((o) => o.metric_type === 'weight')) {
      missingData.push('Chưa ghi nhận cân nặng');
    }

    const summaryText =
      completed.length > 0
        ? `[AI Tóm tắt] Trong 7 ngày qua (${context.date_window.from} - ${context.date_window.to}), bạn đã hoàn thành ${completed.length} buổi tập rèn luyện. Tinh thần kỷ luật rất tốt.`
        : `[AI Tóm tắt] Trong 7 ngày qua (${context.date_window.from} - ${context.date_window.to}), chưa có buổi tập nào được hoàn thành. Hãy bắt đầu với bài tập nhẹ nhàng.`;

    return {
      summary: summaryText,
      period: {
        from: context.date_window.from,
        to: context.date_window.to,
      },
      references,
      missing_data: missingData,
    };
  }

  async answer(
    context: AIContextPayload,
    question: string,
    history?: AIMessageHistoryItem[]
  ): Promise<AIAnswerOutput> {
    void history;
    if (this.options.delayMs) {
      await new Promise((res) => setTimeout(res, this.options.delayMs));
    }

    if (this.options.shouldThrowError) {
      throw new Error(this.options.errorMessage || 'MOCK_AI_ERROR: Giả lập lỗi hỏi đáp AI');
    }

    if (this.options.customAnswerOutput) {
      return {
        answer: this.options.customAnswerOutput.answer || 'Câu trả lời mẫu',
        references: this.options.customAnswerOutput.references || [],
        period_used: this.options.customAnswerOutput.period_used ?? null,
        missing_data_acknowledged: this.options.customAnswerOutput.missing_data_acknowledged ?? false,
        out_of_scope: this.options.customAnswerOutput.out_of_scope ?? false,
      };
    }

    const lowerQ = question.toLowerCase();

    // Kiểm tra phạm vi y tế / chẩn đoán / thuốc men
    if (
      lowerQ.includes('chẩn đoán') ||
      lowerQ.includes('kê đơn') ||
      lowerQ.includes('thuốc') ||
      lowerQ.includes('bệnh') ||
      lowerQ.includes('readiness score') ||
      lowerQ.includes('điểm hồi phục')
    ) {
      return {
        answer:
          'CalisCoaching là ứng dụng hỗ trợ theo dõi rèn luyện và không có chức năng chẩn đoán y khoa, kê đơn thuốc hay đánh giá trạng thái hồi phục lâm sàng. Vui lòng tham khảo ý kiến bác sĩ chuyên môn.',
        references: [],
        period_used: null,
        missing_data_acknowledged: true,
        out_of_scope: true,
      };
    }

    // Câu hỏi bình thường: tìm hoạt động hoặc mục tiêu liên quan
    const completed = context.activities.filter((a) => !a.is_planned);
    const references = completed.slice(0, 3).map((a) => ({
      type: 'activity' as const,
      id: a.id,
      description: `Hoạt động ${a.activity_type}`,
    }));

    return {
      answer: `Dựa trên nhật ký ${context.date_window.from} đến ${context.date_window.to}, bạn có ${completed.length} buổi tập đã hoàn thành. Hãy duy trì nhịp độ ổn định.`,
      references,
      period_used: `${context.date_window.from} - ${context.date_window.to}`,
      missing_data_acknowledged: completed.length === 0,
      out_of_scope: false,
    };
  }

  async analyzeTrends(metrics: unknown): Promise<AITrendAnalysisOutput> {
    if (this.options.delayMs) {
      await new Promise((res) => setTimeout(res, this.options.delayMs));
    }

    if (this.options.shouldThrowError) {
      throw new Error(this.options.errorMessage || 'MOCK_AI_ERROR: Giả lập lỗi phân tích xu hướng');
    }

    if (this.options.customTrendOutput) {
      return {
        highlights: this.options.customTrendOutput.highlights || [],
        missing_data: this.options.customTrendOutput.missing_data || [],
        period: this.options.customTrendOutput.period || { from: '', to: '', weeks: 4 },
      };
    }

    return generateTemplateTrendAnalysis(metrics as ProfileMetrics);
  }
}
