/**
 * CALISCOACHING MVP - SCHEMA ĐẦU RA CÓ CẤU TRÚC (ZOD SCHEMAS - AGENT E)
 * Kiểm chứng tính hợp lệ của dữ liệu phản hồi từ AI trước khi lưu vào database.
 */

import { z } from 'zod';
import { AISummaryOutput, AIAnswerOutput, AITrendAnalysisOutput } from './types';

export const AIReferenceItemSchema = z.object({
  type: z.enum(['goal', 'activity', 'observation', 'profile']),
  id: z.string().min(1, 'ID tham chiếu không được rỗng'),
  description: z.string().optional(),
});

export const AISummaryOutputSchema = z.object({
  summary: z.string().min(10, 'Nội dung tóm tắt quá ngắn'),
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  references: z.array(AIReferenceItemSchema),
  missing_data: z.array(z.string()),
});

export const AIAnswerOutputSchema = z.object({
  answer: z.string().min(5, 'Câu trả lời quá ngắn'),
  references: z.array(AIReferenceItemSchema),
  period_used: z.string().nullable().optional().default(null),
  missing_data_acknowledged: z.boolean(),
  out_of_scope: z.boolean(),
});

export const AITrendHighlightSchema = z.object({
  metric_key: z.string().min(1),
  text: z.string().min(5),
  references: z.array(AIReferenceItemSchema),
});

export const AITrendAnalysisOutputSchema = z.object({
  highlights: z.array(AITrendHighlightSchema),
  missing_data: z.array(z.string()),
  period: z.object({
    from: z.string(),
    to: z.string(),
    weeks: z.number(),
  }),
});

/**
 * Kiểm tra và parse đầu ra JSON tóm tắt của AI qua Zod.
 */
export function validateAISummaryOutput(data: unknown): AISummaryOutput {
  return AISummaryOutputSchema.parse(data);
}

/**
 * Kiểm tra và parse đầu ra JSON câu hỏi đáp của AI qua Zod.
 */
export function validateAIAnswerOutput(data: unknown): AIAnswerOutput {
  return AIAnswerOutputSchema.parse(data);
}

/**
 * Kiểm tra và parse đầu ra JSON phân tích xu hướng của AI qua Zod.
 */
export function validateAITrendAnalysisOutput(data: unknown): AITrendAnalysisOutput {
  return AITrendAnalysisOutputSchema.parse(data);
}
