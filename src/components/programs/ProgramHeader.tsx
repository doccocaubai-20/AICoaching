import React from 'react';
import { Dumbbell, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import { ProgramEntity } from '@/contracts';

interface ProgramHeaderProps {
  program: ProgramEntity | null;
  fetchError?: string | null;
}

export function ProgramHeader({ program, fetchError }: ProgramHeaderProps) {
  const title = program?.title || 'Calisthenics Cơ Bản Minh Họa (Demo)';
  const version = program?.version || '1.0.0-demo';
  const description =
    program?.description ||
    'Chương trình bài tập nền tảng calisthenics phục vụ mục đích kiểm thử và demo giao diện ứng dụng.';

  return (
    <div className="space-y-4">
      {/* Tiêu đề & Phiên bản */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-600" />
            <span>{title}</span>
          </h1>
          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 uppercase tracking-wider">
            Minh họa Demo • v{version}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>

      {/* CẢNH BÁO NỘI DUNG MINH HỌA - BẮT BUỘC THEO QUY ĐỊNH */}
      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-[11px] uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Cảnh báo nội dung thử nghiệm (Demo)
          </p>
          <p className="text-[11px] leading-relaxed">
            Giáo án và danh mục động tác dưới đây mang tính chất <strong>minh họa kỹ thuật</strong> phục vụ kiểm thử phần mềm. 
            <strong> Tuyệt đối chưa qua thẩm định y khoa hoặc huấn luyện viên thể thao chuyên nghiệp</strong>. 
            Không hướng dẫn người thật tập theo như một giáo án đã được xác thực.
          </p>
        </div>
      </div>
    </div>
  );
}
