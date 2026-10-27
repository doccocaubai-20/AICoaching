import React from 'react';
import {
  Dumbbell,
  AlertTriangle,
  PlayCircle,
  CheckCircle,
  Info,
  CalendarClock,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';

export default function ProgramsPage() {
  const envStatus = getSupabaseEnvStatus();

  return (
    <div className="p-4 space-y-5">
      {!envStatus.isConfigured && (
        <CredentialStatusBanner
          isConfigured={envStatus.isConfigured}
          missingKeys={envStatus.missingKeys}
        />
      )}

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-600" />
            <span>Luyện tập Calisthenics</span>
          </h1>
          <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded uppercase">
            Minh họa Demo
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Một nội dung/buổi tập mẫu để trải nghiệm ghi kết quả vào hồ sơ
        </p>
      </div>

      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Phụ trách bởi Agent D:</span>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
            Xây dựng giao diện buổi tập mẫu, ghi kết quả tự khai và cập nhật hồ sơ với cơ chế chống ghi trùng (idempotency key).
          </p>
        </div>
      </div>

      {/* Cảnh báo chuyên môn */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Cảnh báo nội dung thử nghiệm
          </p>
          <p className="text-[11px] leading-relaxed">
            Giáo án và số hiệp/lần dưới đây chỉ phục vụ mục đích kiểm thử phần mềm (demo). 
            Chưa qua rà soát bởi huấn luyện viên hoặc chuyên gia y tế thể thao. 
            Không hướng dẫn người thật tập theo như một giáo án đã xác thực.
          </p>
        </div>
      </div>

      {/* Buổi tập mẫu */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Buổi 1: Thân trên - Kéo & Đẩy (Demo)
          </span>
          <span className="text-[11px] text-slate-500 font-medium">~ 35 phút</span>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800 dark:text-slate-200">1. Hít xà đơn (Pull-up)</span>
            <span className="text-slate-500">3 hiệp x 5-8 lần</span>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800 dark:text-slate-200">2. Chống đẩy (Push-up)</span>
            <span className="text-slate-500">3 hiệp x 8-12 lần</span>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800 dark:text-slate-200">3. Treo xà (Dead hang)</span>
            <span className="text-slate-500">3 hiệp x 30s</span>
          </div>
        </div>

        <button
          disabled
          className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed"
        >
          <PlayCircle className="w-4 h-4" />
          <span>Bắt đầu buổi tập (Sẽ kích hoạt ở Agent D)</span>
        </button>
      </div>

      {/* Khối gợi ý xem lại lịch demo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <CalendarClock className="w-4 h-4 text-emerald-600" />
          <span>Quy tắc xem lại lịch (Review Suggestion)</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Quy tắc kiểm tra lịch hoạt động gần nhau (ví dụ: chơi cầu lông 90 phút sát buổi calisthenics). 
          Chỉ gợi ý xem xét lịch, tuyệt đối không tự ý điều chỉnh tải tập hoặc kết luận hồi phục.
        </p>
      </div>
    </div>
  );
}
