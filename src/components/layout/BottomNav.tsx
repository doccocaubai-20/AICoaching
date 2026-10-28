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
    label: 'Lịch sử',
    icon: CalendarCheck2,
    matches: ['/activities'],
  },
  {
    href: '/groups',
    label: 'Đồng hành',
    icon: Users,
    matches: ['/groups'],
  },
  {
    href: '/profile',
    label: 'Cá nhân',
    icon: UserCheck,
    matches: ['/profile', '/health', '/passport', '/briefs', '/ai'],
  },
];

// Phải nằm bên trong <Link> để useLinkStatus biết link này đang chuyển trang.
function NavItemIcon({ icon: Icon, isActive }: { icon: LucideIcon; isActive: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 aria-label="Đang chuyển trang" className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />;
  }
  return <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />;
}

export function BottomNav() {
  const pathname = usePathname();

  // Ẩn thanh điều hướng trên các trang công khai, chia sẻ hoặc đăng nhập/đăng ký
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/shared/')
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-[480px] mx-auto grid grid-cols-5 h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = item.matches.some(
            (pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`)
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <NavItemIcon icon={item.icon} isActive={isActive} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
