'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Lock, Mail, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseEnvStatus, SupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';
import { ExperienceLevel } from '@/contracts/database.types';

export default function RegisterPage() {
  const router = useRouter();
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
      setErrorMessage('Mật khẩu tối thiểu phải có 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Không thể kết nối Supabase client');
      }

      // Hồ sơ được tạo ở database (trigger handle_new_user) từ metadata này,
      // nên vẫn có hồ sơ kể cả khi cần xác nhận email trước khi có phiên đăng nhập.
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
          router.push('/dashboard');
          router.refresh();
        }, 1200);
      } else if (authData.user) {
        setSuccessMessage('Đăng ký thành công! Vui lòng mở email để xác nhận tài khoản, sau đó đăng nhập.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi đăng ký.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 flex-1 flex flex-col justify-center">
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
            Bắt đầu theo dõi quá trình tập luyện và tương tác AI cá nhân
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên hiển thị
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ví dụ: Hoàng Nam"
                required
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu (tối thiểu 6 ký tự)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kinh nghiệm Calisthenics
            </label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="beginner">Người mới bắt đầu (Beginner)</option>
              <option value="intermediate">Đã tập một thời gian (Intermediate)</option>
              <option value="advanced">Nâng cao / Thành thạo (Advanced)</option>
            </select>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pt-1">
            Bằng việc đăng ký, bạn xác nhận hiểu rằng ứng dụng cung cấp nội dung <strong>minh họa kỹ thuật</strong> và không thay thế tư vấn y tế/thể thao chuyên môn.
          </p>

          <button
            type="submit"
            disabled={isLoading || (envStatus !== null && !envStatus.isConfigured)}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-medium text-sm rounded-lg transition duration-150 flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <span>Đang tạo tài khoản...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Đăng ký tài khoản</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
