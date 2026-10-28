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
  Clock,
  ArrowRight,
  ShieldCheck,
  Film,
  Calendar,
} from 'lucide-react';

export const metadata = {
  title: 'Trung Tâm Trải Nghiệm Demo | CalisCoaching',
  description: 'Trải nghiệm toàn bộ 6 điểm nhấn tính năng qua 3 lối vào chính và kịch bản hướng dẫn thực tế.',
};

export default function DemoHubPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <p className="p-4 rounded-xl border border-amber-500/40 text-amber-200 text-sm">Đây là hướng dẫn dùng các tính năng trên tài khoản đang đăng nhập. Trang này không tạo sẵn hay xóa dữ liệu. Nếu bấm lưu trong các tính năng, dữ liệu sẽ thuộc tài khoản của bạn. Để trình diễn, hãy dùng một tài khoản thử nghiệm riêng và chỉ nhập thông tin mẫu.</p>
        {/* 1. Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 shadow-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kịch bản Trải nghiệm Điểm nhấn CalisCoaching</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Trung Tâm Demo Điểm Nhấn
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Khám phá trọn vẹn 6 điểm nhấn công nghệ được phối hợp giữa 4 module: Ghi nhận tự nhiên,
            Phiên tập trực tiếp có bộ đếm nghỉ, Hành trình kỹ năng kèm video đối chiếu, Bản tóm tắt
            có nguồn xác minh và Nhóm đồng hành kỷ luật.
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Hướng dẫn trên tài khoản đang dùng • Không tạo dữ liệu tự động</span>
          </div>
        </div>

        {/* 2. Ba lối vào chính (Three Primary Entry Points) */}
        <div>
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>3 Lối Vào Trọng Tâm</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Lối vào 1: Ghi nhận nhanh */}
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
                  Nhập ngôn ngữ tự nhiên: môn tập, thời lượng, RPE và giấc ngủ lưu nguyên tử.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                <span>Mở Ghi Nhanh</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Lối vào 2: Tiếp tục tập */}
            <Link
              href="/workout"
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Play className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                  2. Tập Luyện & Resume
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Theo dõi từng hiệp, đếm ngược thời gian nghỉ, phục hồi phiên dở dang và hoàn thành nguyên tử.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                <span>Mở Tập Luyện</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Lối vào 3: Hành trình kỹ năng */}
            <Link
              href="/journey"
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                  3. Hành Trình & Video
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cây mốc tiến độ chuẩn hóa, gắn chứng cứ thực tế và so sánh đối chiếu 2 clip lần thử.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-1 text-xs text-amber-400 font-semibold">
                <span>Mở Hành Trình</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* 3. Lối vào bổ trợ: Bản Tóm Tắt & Nhóm */}
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
                  Nhóm 1-5 người, cam kết tuần tự nguyện, không chia sẻ hồ sơ y tế
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition" />
          </Link>
        </div>

        {/* 4. Kịch bản trình diễn (Demo Walkthroughs) */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Kịch Bản Trình Diễn Khuyến Nghị
          </h2>

          {/* Option A: Kịch bản 3 phút Express */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  3 PHÚT
                </div>
                <h3 className="font-bold text-sm text-white">Express Demo: Trải nghiệm Nhanh</h3>
              </div>
              <span className="text-xs text-slate-400">Thích hợp xem nhanh tính khả thi</span>
            </div>

            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Bước 1: Ghi nhận nhanh tại /capture:</strong> Nhập câu mẫu{' '}
                  <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded">
                    &quot;chạy bộ 25 phút mệt 7 hôm qua ngủ 7 tiếng&quot;
                  </code>
                  , chọn phân tách RPE/căng thẳng và lưu nguyên tử.
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
                  <strong className="text-white">Bước 3: Mở /briefs:</strong> Xem bản tóm tắt tự động, tạo link bí mật,
                  mở cửa sổ ẩn danh xem snapshot an toàn và thử nghiệm cơ chế stale detection.
                </div>
              </li>
            </ol>
          </div>

          {/* Option B: Kịch bản 10 phút Complete Flow */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                  10 PHÚT
                </div>
                <h3 className="font-bold text-sm text-white">Toàn Diện: Trọn Vẹn 4 Module Điểm Nhấn</h3>
              </div>
              <span className="text-xs text-slate-400">Đầy đủ quy trình tích hợp</span>
            </div>

            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Ghi nhanh:</strong> Kiểm tra receipt có liên kết mở đúng chi tiết bản ghi tại{' '}
                  <Link href="/activities" className="text-emerald-400 hover:underline">
                    Nhật ký
                  </Link>{' '}
                  hoặc{' '}
                  <Link href="/profile" className="text-emerald-400 hover:underline">
                    Hồ sơ
                  </Link>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Buổi tập trực tiếp:</strong> Hoàn thành buổi tập, sau đó bấm CTA chuyển ngữ cảnh trực tiếp sang Hành trình kỹ năng và Nhóm cam kết.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Hành trình kỹ năng:</strong> Chọn mốc hít xà, gắn chứng cứ là buổi tập thực vừa hoàn thành, nhập số reps thực tế (khác target) và lưu.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <span>
                  <strong>Đối chiếu video:</strong> Mở trang{' '}
                  <Link href="/journey/compare" className="text-amber-400 hover:underline">
                    So sánh clip
                  </Link>{' '}
                  để kiểm tra trình phát hai clip đồng bộ không trễ.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  5
                </span>
                <span>
                  <strong>Tóm tắt & Chia sẻ:</strong> Kiểm tra link chia sẻ công khai không lộ ID nội bộ, cảnh báo khi nguồn bị sửa/xóa.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  6
                </span>
                <span>
                  <strong>Nhóm kỷ luật:</strong> Tạo lời mời, chấp nhận vào nhóm và gửi nháp cam kết tuần với xác nhận rõ ràng.
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* 5. Footer & Navigation */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800">
          <div>CalisCoaching MVP • Nền tảng huấn luyện Calisthenics cá nhân hóa</div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-emerald-400 hover:underline">
              Bảng điều khiển
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
