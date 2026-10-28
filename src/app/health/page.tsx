import { redirect } from 'next/navigation';

interface HealthPageProps {
  searchParams?: Promise<{
    date?: string;
    highlight?: string;
    [key: string]: string | undefined;
  }>;
}

/**
 * CANONICAL REDIRECT (P0.3):
 * Thống nhất nguồn giao diện sức khỏe về `/profile?tab=health`.
 * Bảo toàn 100% các query parameters (date, highlight...) để không làm gãy deep links.
 */
export default async function HealthPage({ searchParams }: HealthPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  query.set('tab', 'health');
  for (const [key, val] of Object.entries(resolvedParams)) {
    if (key !== 'tab' && val) {
      query.set(key, val);
    }
  }

  redirect(`/profile?${query.toString()}`);
}
