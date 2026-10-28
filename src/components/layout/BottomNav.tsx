'use client';

import React from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck2,
  Dumbbell,
  Users,
  UserCheck,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matches: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Hôm nay',
    icon: LayoutDashboard,
    matches: ['/dashboard', '/capture'],
  },
  {
    href: '/programs',
    label: 'Tập luyện',
    icon: Dumbbell,
    matches: ['/programs', '/workout', '/journey'],
  },
  {
    href: '/activities',
    label: 'Nhật ký',
    icon: CalendarCheck2,
    matches: ['/activities'],
  },
  {
    href: '/groups',
    label: 'Nhóm',
    icon: Users,
    matches: ['/groups'],
  },
  {
    href: '/me',
    label: 'Cá nhân',
    icon: UserCheck,
    matches: ['/me', '/profile', '/health', '/passport', '/briefs', '/ai'],
  },
];

function NavItemIcon({ icon: Icon, isActive }: { icon: LucideIcon; isActive: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 aria-label="Đang chuyển trang" className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />;
  }
  return <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />;
}

export function BottomNav() {
  const pathname = usePathname();

  // Ẩn thanh điều hướng trên các trang công khai, chia sẻ hoặc đăng nhập/đăng ký/dùng thử
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/try' ||
    pathname.startsWith('/shared/')
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.matches.some((prefix) =>
            prefix === '/dashboard'
              ? pathname === '/dashboard' || pathname.startsWith('/capture')
              : pathname.startsWith(prefix)
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <NavItemIcon icon={item.icon} isActive={isActive} />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
