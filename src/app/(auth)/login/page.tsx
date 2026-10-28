'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Lock, Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseEnvStatus, SupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { getSafeRedirectUrl } from '@/lib/auth/safe-redirect';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [envStatus, setEnvStatus] = useState<SupabaseEnvStatus | null>(null);

  useEffect(() => {
    setEnvStatus(getSupabaseEnvStatus());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!envStatus?.isConfigured) {
      setErrorMessage(
        'Không thể đăng nhập: Chưa cấu hình Supabase credentials. Vui lòng thiết lập .env.local theo hướng dẫn.'
      );
      return;
    }

    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Không thể khởi tạo client Supabase');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Email hoặc mật khẩu không chính xác.');
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (data.user) {
        const nextUrl = searchParams.get('next');
        const intent = searchParams.get('intent');
        const target = getSafeRedirectUrl(nextUrl, intent);
        router.push(target);
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi đăng nhập.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextParam = searchParams.get('next');
  const intentParam = searchParams.get('intent');
  const registerQuery = new URLSearchParams();
  if (nextParam) registerQuery.set('next', nextParam);
  if (intentParam) registerQuery.set('intent', intentParam);
  const registerHref = registerQuery.toString() ? `/register?${registerQuery.toString()}` : '/register';

  return (
    <div className="p-5 flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
      {envStatus && !envStatus.isConfigured && (
        <CredentialStatusBanner
          isConfigured={envStatus.isConfigured}
          missingKeys={envStatus.missingKeys}
        />
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Đăng nhập tài khoản
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Đăng nhập để xem hồ sơ và nhật ký luyện tập cá nhân
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>Đăng nhập</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Chưa có tài khoản?{' '}
          <Link
            href={registerHref}
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Đang tải trang đăng nhập...</div>}>
      <LoginForm />
    </Suspense>
  );
}
