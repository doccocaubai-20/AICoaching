/**
 * CALISCOACHING - HỢP ĐỒNG TÀI LIỆU SỨC KHỎE (HEALTH DOCUMENT CONTRACT)
 * Quản lý metadata tài liệu y tế, phiếu khám, kết quả xét nghiệm.
 * Giới hạn: tối đa 4 MiB/tệp để nằm trong giới hạn payload của Vercel Functions.
 */

import { HealthDocumentFileType } from './database.types';

export const MAX_DOCUMENT_SIZE_BYTES = 4 * 1024 * 1024; // 4 MiB
export const USER_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024; // 100MB cho mỗi người dùng
export const ALLOWED_DOCUMENT_MIME_TYPES: HealthDocumentFileType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export interface HealthDocumentEntity {
  id: string;
  user_id: string;
  event_id: string | null;
  title: string;
  file_name: string;
  file_type: HealthDocumentFileType;
  file_size_bytes: number;
  storage_path: string;
  notes: string | null;
  upload_status?: 'pending' | 'ready';
  created_at: string;
  updated_at: string;
}

export interface CreateHealthDocumentInput {
  event_id?: string | null;
  title: string;
  file_name: string;
  file_type: HealthDocumentFileType;
  file_size_bytes: number;
  storage_path: string;
  notes?: string | null;
}

export function validateHealthDocumentInput(input: Partial<CreateHealthDocumentInput>): { is_valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.title || input.title.trim().length === 0) {
    errors.title = 'Tên tài liệu không được để trống.';
  } else if (input.title.length > 200) {
    errors.title = 'Tên tài liệu không được vượt quá 200 ký tự.';
  }

  if (!input.file_name || input.file_name.trim().length === 0) {
    errors.file_name = 'Tên tệp không được để trống.';
  }

  if (!input.file_type || !ALLOWED_DOCUMENT_MIME_TYPES.includes(input.file_type)) {
    errors.file_type = 'Chỉ hỗ trợ tệp định dạng PDF, JPG hoặc PNG.';
  }

  if (typeof input.file_size_bytes !== 'number' || input.file_size_bytes <= 0) {
    errors.file_size_bytes = 'Kích thước tệp không hợp lệ.';
  } else if (input.file_size_bytes > MAX_DOCUMENT_SIZE_BYTES) {
    errors.file_size_bytes = 'Kích thước tệp vượt quá giới hạn 4 MiB cho phép.';
  }

  if (!input.storage_path || input.storage_path.trim().length === 0) {
    errors.storage_path = 'Đường dẫn lưu trữ không được để trống.';
  }

  return {
    is_valid: Object.keys(errors).length === 0,
    errors,
  };
}
