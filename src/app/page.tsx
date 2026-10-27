import React from 'react';
import Link from 'next/link';
import {
  Dumbbell,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  CalendarCheck2,
  BotMessageSquare,
  Sparkles,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';

export default function HomePage() {
  const envStatus = getSupabaseEnvStatus();

  return (
    <div className="p-4 space-y-6">
      {/* Cảnh báo trạng thái credential */}
      {!envStatus.isConfigured && (
        <CredentialStatusBanner
          isConfigured={envStatus.isConfigured}
          missingKeys={envStatus.missingKeys}
        />
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-6 text-white shadow-lg space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[11px] font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Hồ sơ & Trợ lý AI Vận động</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight leading-snug">
          Hiểu rõ quá trình vận động cá nhân với sự hỗ trợ từ AI
        </h1>

        <p className="text-xs text-emerald-100 leading-relaxed">
          Ghi nhận hoạt động calisthenics, chạy bộ, cầu lông... và nhận câu trả lời có trích dẫn dữ liệu minh bạch, tôn trọng quyền riêng tư.
        </p>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/dashboard"
            className="w-full py-3 px-4 bg-white text-emerald-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition shadow-sm"
          >
            <span>Vào Bảng Tổng quan (Dashboard)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="flex-1 py-2 px-3 text-center bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-xs font-medium transition"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="flex-1 py-2 px-3 text-center bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-xs font-medium transition"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </section>

      {/* Phạm vi MVP & Trụ cột kỹ thuật */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Các chức năng chính (MVP)
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/profile"
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/50 transition group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition">
              Hồ sơ & Mục tiêu
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Lưu dụng cụ, lịch rảnh, chỉ số tự khai (Agent B)
            </p>
          </Link>

          <Link
            href="/activities"
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/50 transition group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition">
              Nhật ký đa môn
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Calisthenics, chạy, cầu lông, đi bộ (Agent C)
            </p>
          </Link>

          <Link
            href="/programs"
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/50 transition group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition">
              Tập luyện Demo
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Buổi tập minh họa calisthenics (Agent D)
            </p>
          </Link>

          <Link
            href="/ai"
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-500/50 transition group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
              <BotMessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition">
              Trợ lý AI hồ sơ
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Tóm tắt & hỏi đáp có trích dẫn nguồn (Agent E)
            </p>
          </Link>
        </div>
      </section>

      {/* Cam kết ranh giới MVP */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <ShieldAlert className="w-4 h-4 text-slate-500" />
          <span>Ranh giới kỹ thuật & An toàn y khoa</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
          <li><strong>Không xây trong MVP:</strong> Chức năng HLV, chia sẻ QR, Strava, phân tích video, dinh dưỡng hay thanh toán.</li>
          <li><strong>Quyền riêng tư:</strong> Row Level Security (RLS) bảo đảm người dùng chỉ đọc và sửa dữ liệu của chính mình.</li>
          <li><strong>AI an toàn:</strong> Không tự động chẩn đoán y tế, không kết luận phục hồi, không tự thay đổi lịch tập hay sửa đổi hồ sơ.</li>
        </ul>
      </section>
    </div>
  );
}
