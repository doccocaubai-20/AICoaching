/**
 * CALISCOACHING MVP - HỢP ĐỒNG ĐỒNG Ý CHIA SẺ DỮ LIỆU AI (AI CONSENT CONTRACT)
 * Cung cấp cho Agent E (AI Tóm tắt & Hỏi đáp) và Agent F.
 *
 * NGUYÊN TẮC:
 * 1. Phải có sự đồng ý minh bạch từ người dùng trước khi gửi bất kỳ dữ liệu nào đến AI.
 * 2. Người dùng có quyền rút lại đồng ý bất cứ lúc nào.
 * 3. Khi đồng ý bị rút lại (is_granted = false hoặc revoked_at != null),
 *    mọi yêu cầu gọi AI tiếp theo BỊ CHẶN NGAY LẬP TỨC ở tầng Server.
 */

export const CURRENT_CONSENT_VERSION = 'v1.0-mvp';

export type ConsentScopeItem = 'profile' | 'goals' | 'activities' | 'observations';

export interface AIConsentEntity {
  id: string;
  user_id: string;
  consent_version: string;
  scope: string[];
  is_granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrantConsentInput {
  scope?: ConsentScopeItem[];
  consent_version?: string;
}
