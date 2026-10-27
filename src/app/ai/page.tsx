import React from 'react';
import {
  BotMessageSquare,
  Sparkles,
  ShieldCheck,
  Send,
  AlertCircle,
  FileText,
  Info,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { getSupabaseEnvStatus } from '@/lib/supabase/env';
import { CredentialStatusBanner } from '@/components/ui/CredentialStatusBanner';

export default function AIPage() {
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
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BotMessageSquare className="w-5 h-5 text-purple-600" />
          <span>Trợ lý AI theo hồ sơ</span>
        </h1>
        <p className="text-xs text-slate-500">
          Tóm tắt quá trình và hỏi đáp dựa trên dữ liệu nhật ký có trích dẫn nguồn
        </p>
      </div>

      <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl text-purple-900 dark:text-purple-200 text-xs flex items-start gap-2">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Phụ trách bởi Agent E:</span>
          <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-0.5">
            Xây dựng adapter gọi AI thật từ Server qua biến môi trường bí mật; cơ chế xin đồng ý/rút đồng ý; tóm tắt & hỏi đáp có trích dẫn nguồn; kích hoạt fallback mẫu có nhãn &ldquo;Không dùng AI&rdquo; khi lỗi hoặc thiếu khóa.
          </p>
        </div>
      </div>

      {/* Trạng thái đồng ý chia sẻ dữ liệu */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Đồng ý chia sẻ dữ liệu với AI</span>
          </div>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-medium">
            Chưa kích hoạt
          </span>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Theo chính sách bảo mật MVP, AI chỉ nhận các trường dữ liệu tối thiểu (mục tiêu, thời lượng tập, mức mệt) mà bạn đồng ý. Bạn có quyền xem/xóa lịch sử và rút lại đồng ý bất cứ lúc nào để lập tức ngăn chặn các lần gửi sau.
        </p>

        <button
          disabled
          className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium text-xs rounded-lg cursor-not-allowed"
        >
          Đồng ý chia sẻ dữ liệu (Sẽ tích hợp ở Agent E)
        </button>
      </section>

      {/* Tác vụ 1: Tóm tắt hồ sơ */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-purple-600" />
            <span>Tóm tắt hồ sơ vận động</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Tạo ảnh chụp tóm tắt các hoạt động trong tuần, nêu rõ khoảng thời gian, nguồn dữ liệu và thừa nhận các dữ liệu còn thiếu (ví dụ: chưa có cân nặng).
        </p>

        <button
          disabled
          className="w-full py-2 bg-purple-600/50 text-white font-medium text-xs rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tạo bản tóm tắt hồ sơ</span>
        </button>
      </section>

      {/* Tác vụ 2: Hỏi đáp theo hồ sơ */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <BotMessageSquare className="w-4 h-4 text-purple-600" />
            <span>Hỏi đáp theo dữ liệu hồ sơ</span>
          </div>
          <button
            disabled
            className="text-[11px] text-slate-400 flex items-center gap-1 cursor-not-allowed"
            title="Xóa lịch sử chat"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa lịch sử</span>
          </button>
        </div>

        {/* Khung chat mẫu */}
        <div className="min-h-[140px] bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center text-center text-slate-400 text-xs">
          <BotMessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-1" />
          <p className="font-medium text-slate-600 dark:text-slate-300">
            Đặt câu hỏi tiếng Việt về nhật ký của bạn
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ví dụ: &ldquo;Tuần này tôi đã ghi những hoạt động nào?&rdquo;
          </p>
        </div>

        {/* Ô nhập câu hỏi */}
        <div className="flex gap-2">
          <input
            type="text"
            disabled
            placeholder="Nhập câu hỏi theo hồ sơ..."
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed"
          />
          <button
            disabled
            className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Ranh giới an toàn AI */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Quy tắc bảo vệ an toàn AI:</p>
        <p>• AI chỉ sử dụng dữ liệu được phép; không tự ý chẩn đoán y tế hoặc thay đổi kế hoạch tập.</p>
        <p>• Khi thiếu dữ liệu hoặc không có khóa API, hệ thống kích hoạt phản hồi mẫu có nhãn &ldquo;Không dùng AI&rdquo;.</p>
      </div>
    </div>
  );
}
