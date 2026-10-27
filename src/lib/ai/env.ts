/**
 * CALISCOACHING MVP - CẤU HÌNH BIẾN MÔI TRƯỜNG AI (AGENT E)
 * Quản lý các biến môi trường bí mật ở Server (không có tiền tố NEXT_PUBLIC_).
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface AIEnvConfig {
  provider: string;
  apiKey: string | null;
  modelName: string;
  isConfigured: boolean;
}

/**
 * Lấy cấu hình AI hiện hành từ biến môi trường của Server.
 */
export function getAIEnvConfig(): AIEnvConfig {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const apiKey = (process.env.AI_API_KEY || '').trim() || null;
  const modelName = (process.env.AI_MODEL_NAME || '').trim() || DEFAULT_GEMINI_MODEL;

  const isConfigured = provider === 'google' && Boolean(apiKey);

  return {
    provider,
    apiKey,
    modelName,
    isConfigured,
  };
}
