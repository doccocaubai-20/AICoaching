/**
 * CALISCOACHING MVP - GOOGLE GEMINI AI ADAPTER (AGENT E)
 * Adapter chính thức sử dụng @google/genai SDK kết nối Gemini API.
 * Tuân thủ cấu hình structured output, timeout 30s với AbortController,
 * retry 1 lần, telemetry ghi nhận usageMetadata, kiểm tra BLOCKED/TRUNCATED.
 */

import { GoogleGenAI, Type, GenerateContentResponse, FinishReason } from '@google/genai';
import {
  AIAdapter,
  AIContextPayload,
  AISummaryOutput,
  AIAnswerOutput,
  AITrendAnalysisOutput,
  AIMessageHistoryItem,
  AIMetrics,
} from '../types';
import { AI_SYSTEM_INSTRUCTION, formatUserMessagePayload } from '../prompts';
import { validateAISummaryOutput, validateAIAnswerOutput, validateAITrendAnalysisOutput } from '../schemas';

export function logAIMetrics(metrics: AIMetrics): void {
  // NGUYÊN TẮC: Tuyệt đối KHÔNG log dữ liệu cá nhân hay câu hỏi/ghi chú
  console.log(
    JSON.stringify({
      tag: 'AI_TELEMETRY',
      operation: metrics.operation,
      model: metrics.model,
      latencyMs: metrics.latencyMs,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      totalTokens: metrics.totalTokens,
      stopReason: metrics.stopReason,
      errorCode: metrics.errorCode,
    })
  );
}

const SUMMARY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    period: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING },
        to: { type: Type.STRING },
      },
      required: ['from', 'to'],
    },
    references: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          id: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['type', 'id'],
      },
    },
    missing_data: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['summary', 'period', 'references', 'missing_data'],
};

const ANSWER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    references: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          id: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['type', 'id'],
      },
    },
    period_used: { type: Type.STRING },
    missing_data_acknowledged: { type: Type.BOOLEAN },
    out_of_scope: { type: Type.BOOLEAN },
  },
  required: ['answer', 'references', 'missing_data_acknowledged', 'out_of_scope'],
};

const TREND_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    highlights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          metric_key: { type: Type.STRING },
          text: { type: Type.STRING },
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                id: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['type', 'id'],
            },
          },
        },
        required: ['metric_key', 'text', 'references'],
      },
    },
    missing_data: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    period: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING },
        to: { type: Type.STRING },
        weeks: { type: Type.INTEGER },
      },
      required: ['from', 'to', 'weeks'],
    },
  },
  required: ['highlights', 'missing_data', 'period'],
};

export class GeminiAIAdapter implements AIAdapter {
  private ai: GoogleGenAI;
  private model: string;
  private timeoutMs: number;

  constructor(apiKey: string, modelName: string = 'gemini-3.5-flash-lite', timeoutMs: number = 30000) {
    if (!apiKey) {
      throw new Error('API Key của Google Gemini không được để trống');
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.model = modelName;
    this.timeoutMs = timeoutMs;
  }

  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const str = String(error);
    const status = (error as { status?: number }).status;
    return (
      status === 429 ||
      (typeof status === 'number' && status >= 500 && status < 600) ||
      str.includes('429') ||
      str.includes('RESOURCE_EXHAUSTED') ||
      str.includes('503') ||
      str.includes('UNAVAILABLE')
    );
  }

  private async executeWithTimeoutAndRetry(
    operation: 'summary' | 'answer' | 'trend_analysis',
    action: (abortSignal: AbortSignal) => Promise<GenerateContentResponse>
  ): Promise<GenerateContentResponse> {
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = 2; // 1 lần ban đầu + tối đa 1 retry

    while (attempt < maxAttempts) {
      attempt++;
      const controller = new AbortController();
      let timer: NodeJS.Timeout | null = null;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`AI_TIMEOUT: Thời gian phản hồi vượt quá ${this.timeoutMs}ms`));
          }, this.timeoutMs);
        });

        const response = await Promise.race([action(controller.signal), timeoutPromise]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        // 1. Kiểm tra trạng thái bị chặn an toàn
        if (response.promptFeedback?.blockReason) {
          throw new Error(`BLOCKED: Yêu cầu bị chặn bởi chính sách Gemini (${response.promptFeedback.blockReason})`);
        }

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (
          finishReason === FinishReason.SAFETY ||
          finishReason === FinishReason.BLOCKLIST ||
          finishReason === FinishReason.PROHIBITED_CONTENT ||
          finishReason === FinishReason.SPII ||
          finishReason === FinishReason.IMAGE_SAFETY
        ) {
          throw new Error(`BLOCKED: Nội dung bị chặn bởi bộ lọc an toàn (${finishReason})`);
        }

        if (finishReason === FinishReason.MAX_TOKENS) {
          throw new Error('TRUNCATED: Nội dung vượt quá giới hạn độ dài token');
        }

        const latencyMs = Date.now() - startTime;
        logAIMetrics({
          operation,
          model: this.model,
          latencyMs,
          inputTokens: response.usageMetadata?.promptTokenCount,
          outputTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
          stopReason: finishReason,
        });

        return response;
      } catch (err: unknown) {
        if (timer) clearTimeout(timer);

        const isRetryable = this.isRetryableError(err);
        if (isRetryable && attempt < maxAttempts) {
          // Chờ 1 giây trước khi thử lại
          await new Promise((res) => setTimeout(res, 1000));
          continue;
        }

        const latencyMs = Date.now() - startTime;
        const errMessage = err instanceof Error ? err.message : String(err);

        let errorCode = 'API_ERROR';
        if (errMessage.startsWith('AI_TIMEOUT') || controller.signal.aborted) {
          errorCode = 'TIMEOUT';
        } else if (errMessage.startsWith('BLOCKED')) {
          errorCode = 'BLOCKED';
        } else if (errMessage.startsWith('TRUNCATED')) {
          errorCode = 'TRUNCATED';
        } else if (isRetryable && (errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED'))) {
          errorCode = 'RATE_LIMITED';
        }

        logAIMetrics({
          operation,
          model: this.model,
          latencyMs,
          errorCode,
        });

        if (errorCode === 'RATE_LIMITED') {
          throw new Error('AI đang quá tải, thử lại sau');
        }

        throw err;
      }
    }

    throw new Error('Đã thử lại tối đa số lần nhưng không thành công');
  }

  async summarize(context: AIContextPayload): Promise<AISummaryOutput> {
    const userPrompt = 'Hãy tóm tắt nhật ký rèn luyện 7 ngày gần nhất dựa trên dữ liệu đính kèm.';
    const contents = formatUserMessagePayload(userPrompt, JSON.stringify(context, null, 2));

    const response = await this.executeWithTimeoutAndRetry('summary', async (abortSignal) => {
      return await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: SUMMARY_RESPONSE_SCHEMA,
          abortSignal,
        },
      });
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Mô hình AI không trả về nội dung');
    }

    const parsedJson = JSON.parse(responseText);
    return validateAISummaryOutput(parsedJson);
  }

  async answer(
    context: AIContextPayload,
    question: string,
    history?: AIMessageHistoryItem[]
  ): Promise<AIAnswerOutput> {
    const userPrompt =
      'Hãy trả lời câu hỏi của người dùng dựa trên dữ liệu nhật ký và lịch sử trao đổi trong khối dữ liệu dưới đây.';

    // Câu hỏi và lịch sử được đưa trọn vẹn vào trong khối <user_records>
    const dataPayload = {
      context,
      history: history || [],
      question,
    };

    const contents = formatUserMessagePayload(userPrompt, JSON.stringify(dataPayload, null, 2));

    const response = await this.executeWithTimeoutAndRetry('answer', async (abortSignal) => {
      return await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ANSWER_RESPONSE_SCHEMA,
          abortSignal,
        },
      });
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Mô hình AI không trả về nội dung');
    }

    const parsedJson = JSON.parse(responseText);
    return validateAIAnswerOutput(parsedJson);
  }

  async analyzeTrends(metrics: unknown): Promise<AITrendAnalysisOutput> {
    const userPrompt =
      'Dưới đây là các chỉ số xu hướng rèn luyện được tính toán bằng mã thuần. Hãy diễn giải ngắn gọn thành các điểm nổi bật (highlights) kèm metric_key và ID tham chiếu. Tuyệt đối không thay đổi số liệu hay bịa đặt con số khác.';
    const contents = formatUserMessagePayload(userPrompt, JSON.stringify(metrics, null, 2));

    const response = await this.executeWithTimeoutAndRetry('trend_analysis', async (abortSignal) => {
      return await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: AI_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: TREND_RESPONSE_SCHEMA,
          abortSignal,
        },
      });
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Mô hình AI không trả về nội dung phân tích xu hướng');
    }

    const parsedJson = JSON.parse(responseText);
    return validateAITrendAnalysisOutput(parsedJson);
  }
}
