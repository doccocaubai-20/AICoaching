/**
 * CALISCOACHING MVP - LÀM MỚI PHIÊN & CHẶN TRANG CẦN ĐĂNG NHẬP
 * Chạy trong Next.js middleware: làm mới token Supabase trên cookie ở mỗi request
 * và chuyển hướng về /login nếu chưa đăng nhập mà vào trang dữ liệu cá nhân.
 *
 * Khi thiếu cấu hình Supabase: không chặn, vì các trang tự hiển thị banner thiếu
 * credential và không có dữ liệu nào để đọc/ghi.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeSupabaseConfig } from './env';

export const PROTECTED_PATH_PREFIXES = ['/dashboard', '/profile', '/activities', '/programs', '/ai'];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSafeSupabaseConfig();

  if (!config.isConfigured) {
    return response;
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() xác thực token với Supabase Auth và làm mới cookie nếu cần
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
