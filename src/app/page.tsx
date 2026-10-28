import React from 'react';
import Link from 'next/link';
import {
  Zap,
  Dumbbell,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Moon,
  Sparkles,
  Play,
  User,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { getAuthenticatedUser } from '@/lib/server/auth-guard';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';

export const metadata = {
  title: 'CalisCoaching — Ghi lại hôm nay, tiếp tục buổi tập và nhìn thấy quá trình của bạn',
  description: 'Nhật ký vận động cá nhân, buổi tập calisthenics trực tiếp và bản tóm tắt có nguồn xác thực.',
};

export default async function HomePage() {
  const envStatus = getSupabaseEnvStatus();
  let currentUser = null;

  try {
    const { user } = await getAuthenticatedUser();
    currentUser = user;
  } catch {
    currentUser = null;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-8 py-8">
      {/* Cảnh báo trạng thái credential (nếu chưa cấu hình) */}
      {!envStatus.isConfigured && (
        <CredentialStatusBanner
          isConfigured={envStatus.isConfigured}
          missingKeys={envStatus.missingKeys}
        />
      )}

      {/* 1. Lời hứa cốt lõi & Hero Section */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Calisthenics & Nhật ký vận động</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          Ghi lại hôm nay, tiếp tục buổi tập và nhìn thấy quá trình của bạn.
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Ghi một câu thay vì điền form dài. Tiếp tục buổi tập từ đúng hiệp đang dở và chuẩn bị bản tóm tắt có nguồn xác thực khi cần trao đổi.
        </p>

        {/* 2 Lựa chọn có thứ bậc theo mục 3 */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {currentUser ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
            >
              <span>Tiếp tục sử dụng (Vào Hôm nay)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/try"
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Play className="w-4 h-4" />
                <span>Dùng thử trong 2 phút</span>
              </Link>

              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 transition"
              >
                <span>Bắt đầu với dữ liệu của tôi</span>
              </Link>
            </>
          )}
        </div>

        {!currentUser && (
          <div className="text-xs text-slate-500 pt-1">
            Đã có tài khoản?{' '}
            <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
              Đăng nhập tại đây
            </Link>
          </div>
        )}
      </section>

      {/* 2. Ví dụ minh họa trực quan có kết quả (Được ghi nhãn ví dụ) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Ví dụ cách hoạt động
            </h2>
          </div>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-medium">
            Dữ liệu minh họa
          </span>
        </div>

        {/* Bước 1: Câu nhập */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">1. Bạn chỉ cần nhập một câu:</span>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 italic">
            &ldquo;Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi&rdquo;
          </div>
        </div>

        {/* Bước 2: Hai bản ghi được phân tách rõ ràng */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">2. Hệ thống tự động phân tách trước khi bạn lưu:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg">
                <Dumbbell className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Chạy bộ · 25 phút</div>
                <div className="text-[11px] text-slate-500">Nhật ký hoạt động hôm nay</div>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-start gap-2.5">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg">
                <Moon className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">Giấc ngủ · 6.5 giờ</div>
                <div className="text-[11px] text-slate-500">Check-in sinh hoạt đêm qua</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bước 3: Xem lại có nguồn */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500">3. Xem lại và tạo bản tóm tắt có nguồn xác thực:</span>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Mở lại từng bản ghi trong Nhật ký hoặc xuất tóm tắt trao đổi HLV
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              Chính xác &rarr;
            </span>
          </div>
        </div>
      </section>

      {/* 3. Ba giá trị thiết yếu */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>Ghi nhận dễ dàng</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Một câu tiếng Việt ngắn gọn. Luôn xem trước và xác nhận trước khi lưu thật.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Tập luyện có trí nhớ</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Lưu từng hiệp, tiếp tục buổi đang dở và nhớ mức tạ/số lần của buổi trước.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Hồ sơ có nguồn</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Tạo bản tóm tắt gửi HLV hoặc bác sĩ với liên kết có hạn và thu hồi tức thì.
          </p>
        </div>
      </section>

      {/* 4. Cam kết an toàn & Quyền riêng tư */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Quyền riêng tư & An toàn thông tin</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Dữ liệu của bạn được cô lập theo tài khoản. AI chỉ đọc dữ liệu khi bạn cấp quyền. Không tự chẩn đoán y khoa, không thay đổi giáo án ngoài ý muốn của bạn.
        </p>
      </section>
    </div>
  );
}
