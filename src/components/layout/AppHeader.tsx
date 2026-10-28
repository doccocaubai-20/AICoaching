'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, LogOut, ShieldCheck, User } from 'lucide-react';

interface AppHeaderProps {
  userDisplayName?: string | null;
  isLoggedIn?: boolean;
}

export function AppHeader({ userDisplayName, isLoggedIn = false }: AppHeaderProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/shared/') || pathname === '/try') return null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
          <Dumbbell className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
            CalisCoaching
          </span>
          <span className="text-[10px] text-slate-500 font-medium block">
            Nhật ký & Luyện tập cá nhân
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Dữ liệu riêng tư</span>
        </div>

        {isLoggedIn ? (
          <>
            <Link
              href="/me"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                <User className="w-4 h-4" />
              </div>
              <span className="max-w-[80px] truncate hidden sm:inline-block">
                {userDisplayName || 'Cá nhân'}
              </span>
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 dark:text-slate-400 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
