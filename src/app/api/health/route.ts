import { NextResponse } from 'next/server';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const envStatus = getSupabaseEnvStatus();

  let databaseConnected = false;
  let connectionMessage = 'Chưa kiểm tra hoặc chưa cấu hình Supabase credentials';

  if (envStatus.isConfigured) {
    try {
      const supabase = await createServerSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('programs').select('id').limit(1);
        if (!error) {
          databaseConnected = true;
          connectionMessage = 'Kết nối cơ sở dữ liệu Supabase thành công';
        } else {
          connectionMessage = `Lỗi truy vấn cơ sở dữ liệu: ${error.message}`;
        }
      }
    } catch (err: unknown) {
      connectionMessage = `Không thể kết nối máy chủ Supabase: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    project: 'CalisCoaching MVP',
    version: '1.0.0',
    platform: {
      framework: 'Next.js 15 (TypeScript)',
      environment: process.env.NODE_ENV,
    },
    supabase: {
      is_configured: envStatus.isConfigured,
      has_url: envStatus.hasUrl,
      has_anon_key: envStatus.hasAnonKey,
      missing_keys: envStatus.missingKeys,
      database_connected: databaseConnected,
      message: connectionMessage,
    },
    demo_rules: {
      is_demo_mode: true,
      label: 'Nội dung và quy tắc minh họa / demo - Chưa kiểm chứng y khoa/thể thao',
      ai_diagnostic_enabled: false,
    },
  });
}
