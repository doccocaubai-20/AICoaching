import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { DemoNoticeBanner } from '@/components/layout/DemoNoticeBanner';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';

export const metadata: Metadata = {
  title: 'CalisCoaching MVP - Hồ sơ sức khỏe & Vận động',
  description:
    'Ứng dụng theo dõi hồ sơ cá nhân, nhật ký đa hoạt động và trợ lý tương tác AI theo chuẩn MVP CalisCoaching.',
};

// Header phụ thuộc phiên đăng nhập của từng người dùng nên không prerender tĩnh
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getAuthenticatedUser();
  const displayName =
    typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null;

  return (
    <html lang="vi">
      <body className="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
        <div className="mobile-container pb-20">
          <DemoNoticeBanner />
          <AppHeader isLoggedIn={Boolean(user)} userDisplayName={displayName} />
          <main className="flex-1 w-full flex flex-col">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
