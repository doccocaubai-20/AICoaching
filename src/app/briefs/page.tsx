import React from 'react';
import Link from 'next/link';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { getAgentASupabaseClient } from '@/features/common/supabase-a';
import { FileText, Share2, Plus, ArrowLeft, Calendar, Clock } from 'lucide-react';

export const metadata = {
  title: 'Hồ sơ trao đổi & Tóm tắt | CalisCoaching',
  description: 'Quản lý các bản tóm tắt hồ sơ luyện tập và khám bệnh đem đi trao đổi',
};

export default async function BriefsListPage() {
  const { user } = await requireAuthenticatedUser();
  const supabase = await getAgentASupabaseClient();

  let briefs: any[] = [];
  if (supabase) {
    const { data } = await supabase
      .from('health_briefs')
      .select('id, user_id, brief_type, title, date_range_start, date_range_end, user_notes, created_at, brief_shares(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    briefs = (data as any[]) || [];
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/profile?tab=health"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về Hồ sơ sức khỏe</span>
          </Link>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 rounded-full">
            D2 — Hồ sơ trao đổi
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Hồ sơ đem đi trao đổi</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Tạo các bản tóm tắt có nguồn xác thực để trao đổi với HLV calisthenics hoặc chuẩn bị đi khám sức khỏe.
            </p>
          </div>
          <Link
            href="/briefs/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo bản tóm tắt mới</span>
          </Link>
        </div>

        {/* Danh sách các Briefs */}
        {briefs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có bản tóm tắt nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Tạo bản tóm tắt đầu tiên cho giai đoạn tập luyện vừa qua để chia sẻ với người hướng dẫn hoặc bác sĩ.
              </p>
            </div>
            <Link
              href="/briefs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bắt đầu tạo ngay</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefs.map((b) => {
              const shares: any[] = b.brief_shares || [];
              const activeShare = shares.find(
                (s) => !s.revoked_at && new Date(s.expires_at) > new Date()
              );

              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                          b.brief_type === 'workout'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                        }`}
                      >
                        {b.brief_type === 'workout' ? 'Mẫu tập luyện' : 'Mẫu đi khám'}
                      </span>
                      {activeShare ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Đang chia sẻ</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Chưa kích hoạt chia sẻ</span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {b.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {b.date_range_start} &rarr; {b.date_range_end}
                      </span>
                    </div>

                    {b.user_notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg">
                        &ldquo;{b.user_notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tạo ngày {new Date(b.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <Link
                      href={`/briefs/${b.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Xem & Chia sẻ</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
