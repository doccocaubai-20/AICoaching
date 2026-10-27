/**
 * CALISCOACHING MVP - KHÓA CHỐNG GHI TRÙNG
 * Dùng cho activities và session_results.
 *
 * Cách dùng:
 * 1. Sinh khóa một lần khi mở form (không sinh lại mỗi lần bấm lưu).
 * 2. Lưu bằng upsert bỏ qua trùng:
 *    supabase.from('activities').upsert(row, { onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true })
 * 3. Sau khi lưu thành công và mở form mới, sinh khóa mới.
 */

export const IDEMPOTENCY_CONFLICT_TARGET = 'user_id,idempotency_key';

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
