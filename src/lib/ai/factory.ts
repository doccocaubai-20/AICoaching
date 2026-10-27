/**
 * CALISCOACHING MVP - AI ADAPTER FACTORY (AGENT E)
 * Khởi tạo adapter phù hợp theo cấu hình môi trường.
 * NGUYÊN TẮC: MockAIAdapter CHỈ được dùng khi test chèn qua setCustomAIAdapter.
 * Mọi cấu hình khác 'google' + có khóa đều được coi là chưa cấu hình (trả về null).
 */

import { AIAdapter } from './types';
import { getAIEnvConfig } from './env';
import { GeminiAIAdapter } from './providers/gemini';

let customAdapter: AIAdapter | null = null;

export function setCustomAIAdapter(adapter: AIAdapter | null): void {
  customAdapter = adapter;
}

export function getAIAdapter(): AIAdapter | null {
  if (customAdapter) {
    return customAdapter;
  }

  const config = getAIEnvConfig();
  if (config.provider === 'google' && config.apiKey) {
    return new GeminiAIAdapter(config.apiKey, config.modelName);
  }

  return null;
}
