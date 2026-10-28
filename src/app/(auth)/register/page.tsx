'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, Lock, Mail, User, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseEnvStatus, SupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ExperienceLevel } from '@/contracts/database.types';
import { getSafeRedirectUrl } from '@/lib/auth/safe-redirect';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [envStatus, setEnvStatus] = useState<SupabaseEnvStatus | null>(null);

  useEffect(() => {
    setEnvStatus(getSupabaseEnvStatus());
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!envStatus?.isConfigured) {
      setErrorMessage(
        'Không thể đăng ký: Chưa cấu hình Supabase credentials. Vui lòng thiết lập .env.local theo hướng dẫn.'
      );
      return;
    }

    if (!displayName || !email || !password) {
      setErrorMessage('Vui lòng điền đầy đủ các trường thông tin bắt buộc.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Không thể khởi tạo client Supabase');
      }

      const nextUrl = searchParams.get('next');
      const intent = searchParams.get('intent');
      const target = getSafeRedirectUrl(nextUrl, intent);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            experience_level: experienceLevel,
          },
        },
      });

      if (authError) {
        setErrorMessage(authError.message);
        return;
      }

      if (authData.session) {
        setSuccessMessage('Đăng ký thành công! Đang chuyển hướng...');
        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 1000);
      } else if (authData.user) {
        setSuccessMessage('Đăng ký thành công! Vui lòng mở email để xác nhận tài khoản, sau đó đăng nhập để tiếp tục.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi đăng ký.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextParam = searchParams.get('next');
  const intentParam = searchParams.get('intent');
  const loginQuery = new URLSearchParams();
  if (nextParam) loginQuery.set('next', nextParam);
  if (intentParam) loginQuery.set('intent', intentParam);
  const loginHref = loginQuery.toString() ? `/login?${loginQuery.toString()}` : '/login';

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
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tạo tài khoản mới
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bắt đầu ghi lại quá trình vận động cá nhân của bạn
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div className="flex-1 leading-snug">{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Họ và tên hoặc Biệt danh
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

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
              Mật khẩu (tối thiểu 6 ký tự)
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kinh nghiệm tập luyện Calisthenics
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'beginner', label: 'Mới bắt đầu' },
                { value: 'intermediate', label: 'Đã có nền tảng' },
                { value: 'advanced', label: 'Nâng cao' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setExperienceLevel(item.value as ExperienceLevel)}
                  className={`py-2 px-2 text-center text-xs rounded-xl border font-medium transition ${
                    experienceLevel === item.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>Đăng ký tài khoản</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Đã có tài khoản?{' '}
          <Link
            href={loginHref}
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Đang tải trang đăng ký...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
