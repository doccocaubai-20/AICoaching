import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  User,
  HeartPulse,
  Target,
  BotMessageSquare,
  FileText,
  Sparkles,
  Trophy,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Trung tâm Cá nhân | CalisCoaching',
  description: 'Quản lý hồ sơ sức khỏe, mục tiêu rèn luyện, bản tóm tắt và quyền riêng tư.',
};

export default async function MePage() {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect('/login');
  }

  const supabase = await createServerSupabaseClient();
  let displayName = 'Người tập CalisCoaching';
  let email = user.email || '';

  if (supabase) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.display_name) {
      displayName = profile.display_name;
    } else if (user.user_metadata?.display_name) {
      displayName = user.user_metadata.display_name;
    }
  }

  const SECTIONS = [
    {
      id: 'health',
      title: 'Hồ sơ sức khỏe',
      description: 'Huyết áp, chỉ số cơ thể, giấc ngủ, bệnh sử và an toàn',
      href: '/profile?tab=health',
      icon: HeartPulse,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300',
    },
    {
      id: 'goals',
      title: 'Mục tiêu & Dụng cụ',
      description: 'Lịch rảnh, cấp độ kinh nghiệm và mục tiêu tập luyện',
      href: '/profile?tab=goals',
      icon: Target,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    {
      id: 'briefs',
      title: 'Bản tóm tắt trao đổi',
      description: 'Tạo hồ sơ có nguồn xác thực gửi HLV hoặc chuẩn bị đi khám',
      href: '/briefs',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300',
    },
    {
      id: 'passport',
      title: 'Thẻ rèn luyện (Passport)',
      description: 'Thẻ định danh năng lực thể chất và mã QR chia sẻ',
      href: '/passport',
      icon: Sparkles,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300',
    },
    {
      id: 'ai',
      title: 'Trợ lý AI phân tích',
      description: 'Hỏi đáp dựa trên nhật ký vận động có trích dẫn nguồn',
      href: '/ai',
      icon: BotMessageSquare,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300',
    },
    {
      id: 'skills',
      title: 'Hành trình kỹ năng & Video',
      description: 'Mốc chinh phục calisthenics và đối chiếu clip thực hiện',
      href: '/journey',
      icon: Trophy,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300',
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về Hôm nay</span>
        </Link>
        <span className="text-xs font-semibold text-slate-400">Trung tâm Cá nhân</span>
      </div>

      {/* Thông tin tài khoản */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {displayName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{email}</p>
          </div>
        </div>

        <Link
          href="/profile"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Sửa hồ sơ
        </Link>
      </div>

      {/* Danh mục chức năng gọn gàng theo mục 6 */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Các mục chức năng
        </h2>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <Link
                key={sec.id}
                href={sec.href}
                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${sec.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                      {sec.title}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{sec.description}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Cam kết riêng tư & Đăng xuất */}
      <div className="pt-2 space-y-3">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Dữ liệu riêng tư theo tài khoản</span>
          </div>
          <Link href="/profile?tab=health" className="text-emerald-600 font-semibold hover:underline">
            Quản lý quyền
          </Link>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full py-3 px-4 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất khỏi tài khoản</span>
          </button>
        </form>
      </div>
    </div>
  );
}
