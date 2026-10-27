/**
 * CALISCOACHING MVP - QUẢN LÝ BIẾN MÔI TRƯỜNG AN TOÀN
 * Kiểm tra trạng thái cấu hình không chứa bí mật và không làm crash app khi thiếu biến môi trường.
 */

export interface SupabaseEnvStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  missingKeys: string[];
}

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missingKeys: string[] = [];

  const hasUrl = Boolean(url && url.trim().length > 0 && !url.includes('placeholder'));
  const hasAnonKey = Boolean(anonKey && anonKey.trim().length > 0 && !anonKey.includes('placeholder'));
  const hasServiceRoleKey = Boolean(serviceRoleKey && serviceRoleKey.trim().length > 0 && !serviceRoleKey.includes('placeholder'));

  if (!hasUrl) missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!hasAnonKey) missingKeys.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return {
    isConfigured: hasUrl && hasAnonKey,
    hasUrl,
    hasAnonKey,
    hasServiceRoleKey,
    missingKeys,
  };
}

export function getSafeSupabaseConfig() {
  const status = getSupabaseEnvStatus();
  return {
    ...status,
    url: status.hasUrl ? process.env.NEXT_PUBLIC_SUPABASE_URL! : '',
    anonKey: status.hasAnonKey ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! : '',
  };
}
