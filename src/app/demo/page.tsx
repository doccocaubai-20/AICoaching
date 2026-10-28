import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Zap,
  Play,
  Trophy,
  Share2,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Eye,
  BookOpen,
} from 'lucide-react';

export const metadata = {
  title: 'Trung Tâm Demo Điểm Nhấn & Hướng Dẫn | CalisCoaching',
  description: 'Chọn dùng thử tương tác 2 phút không cần tài khoản hoặc xem hướng dẫn thao tác chi tiết trên tài khoản thật.',
};

export default function DemoHubPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Khám phá CalisCoaching</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Trung Tâm Trải Nghiệm & Hướng Dẫn
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Bạn muốn trải nghiệm nhanh các tính năng cốt lõi hay cần kịch bản hướng dẫn chi tiết để tự thao tác trên tài khoản của mình? Hãy chọn phương thức phù hợp bên dưới.
          </p>
        </div>

        {/* 2 Primary Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Interactive Sandbox (Recommended) */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-900 border-2 border-emerald-500/60 shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              Khuyến nghị
            </div>
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Dùng Thử Tương Tác (2 Phút)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Trải nghiệm 3 bước cốt lõi với dữ liệu mẫu cách ly hoàn toàn: Ghi nhận tự nhiên, Buổi tập trực tiếp và Báo cáo tóm tắt.
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1 pt-1">
                <li className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Không cần tạo tài khoản hay đăng nhập</span>
                </li>
                <li className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Không tạo hay ảnh hưởng dữ liệu thật</span>
                </li>
              </ul>
            </div>
            <Link
              href="/try"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md"
            >
              <span>Mở Trải Nghiệm Dùng Thử</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Option 2: Live Account Guided Flow */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">
                Hướng Dẫn Trên Tài Khoản Thật
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kịch bản từng bước để bạn tự thao tác và lưu trữ dữ liệu thật trên chính hồ sơ luyện tập cá nhân của bạn.
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1 pt-1">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span>Cần đăng nhập tài khoản CalisCoaching</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span>Dữ liệu lưu vào hồ sơ riêng tư của bạn</span>
                </li>
              </ul>
            </div>
            <a
              href="#guided-steps"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700"
            >
              <span>Xem Kịch Bản Hướng Dẫn</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* 3 Lối Vào Trọng Tâm */}
        <div id="guided-steps" className="pt-2">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>3 Lối Vào Chính Cho Tài Khoản Thật</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/capture"
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                  1. Ghi Nhanh
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Nhập tự nhiên câu hoạt động, thời lượng, cảm nhận và giấc ngủ để lưu một lần.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                <span>Mở Ghi Nhanh</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/workout"
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Play className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                  2. Tiếp Tục Buổi Tập
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Theo dõi từng hiệp, đếm ngược thời gian nghỉ, tự phục hồi buổi tập dở dang.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                <span>Mở Buổi Tập</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/journey"
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                  3. Hành Trình & Kỹ Năng
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cây mốc tiến độ chuẩn hóa, gắn chứng cứ thực tế và đối chiếu clip lần thử.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-amber-400 font-semibold">
                <span>Mở Hành Trình</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* Lối vào bổ trợ: Bản Tóm Tắt & Nhóm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/briefs"
            className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                  Bản Tóm Tắt & Chia Sẻ An Toàn
                </h4>
                <p className="text-[11px] text-slate-400">
                  Xem trước bản tóm tắt, chọn nội dung và tạo liên kết có hạn
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
          </Link>

          <Link
            href="/groups"
            className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-rose-500/40 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
                  Nhóm Đồng Hành Kỷ Luật
                </h4>
                <p className="text-[11px] text-slate-400">
                  Nhóm 1-5 người, cam kết tuần tự nguyện, không lộ hồ sơ y tế
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition" />
          </Link>
        </div>

        {/* Kịch bản chi tiết */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Kịch Bản Khuyến Nghị Trên Tài Khoản Thật
          </h2>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  3 PHÚT
                </div>
                <h3 className="font-bold text-sm text-white">Quy Trình 3 Bước Cốt Lõi</h3>
              </div>
              <span className="text-xs text-slate-400">Trải nghiệm liền mạch</span>
            </div>

            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Bước 1: Ghi nhận nhanh tại /capture:</strong> Nhập câu mẫu{' '}
                  <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded">
                    &quot;chạy bộ 25 phút mệt 7 hôm qua ngủ 7 tiếng&quot;
                  </code>
                  , kiểm tra bản nháp và lưu.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Bước 2: Mở /workout:</strong> Trải nghiệm bộ đếm thời gian nghỉ
                  tự động, ghi nhận số reps thực tế cho từng hiệp và hoàn thành phiên tập.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Bước 3: Mở /briefs:</strong> Xem bản tóm tắt tự động, tạo link an toàn,
                  mở snapshot và đối chiếu nguồn gốc dữ liệu.
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* Footer & Navigation */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800">
          <div>CalisCoaching • Nền tảng ghi nhận và đồng hành luyện tập</div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-emerald-400 hover:underline">
              Hôm nay
            </Link>
            <span>•</span>
            <Link href="/" className="text-slate-300 hover:underline">
              Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
