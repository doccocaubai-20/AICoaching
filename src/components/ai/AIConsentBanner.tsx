'use client';

/**
 * CALISCOACHING MVP - BANNER ĐỒNG Ý CHIA SẺ DỮ LIỆU AI (AGENT E)
 * Quản lý quyền đồng ý và rút lại đồng ý minh bạch theo chuẩn MVP.
 */

import React, { useState, useTransition } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { AIConsentEntity, CURRENT_CONSENT_VERSION } from '@/contracts';
import { grantConsentAction, revokeConsentAction } from '@/app/ai/actions';
import { formatDateVN } from '@/components/dashboard/date-utils';

interface AIConsentBannerProps {
  consent: AIConsentEntity | null;
  providerName: string;
}

export function AIConsentBanner({ consent, providerName }: AIConsentBannerProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isGranted = Boolean(
    consent?.is_granted && !consent?.revoked_at && consent?.consent_version === CURRENT_CONSENT_VERSION
  );

  const handleGrant = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await grantConsentAction();
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể cấp quyền đồng ý');
      }
    });
  };

  const handleRevoke = () => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn rút lại quyền đồng ý? AI sẽ không thể truy cập dữ liệu nhật ký của bạn cho đến khi được cấp quyền lại.'
      )
    ) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await revokeConsentAction();
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể rút lại quyền đồng ý');
      }
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          {isGranted ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          )}
          <span>Đồng ý chia sẻ dữ liệu với AI</span>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            isGranted
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
          }`}
        >
          {isGranted ? 'Đang kích hoạt' : 'Chưa kích hoạt'}
        </span>
      </div>

      <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
        <p>
          Theo chính sách bảo mật CalisCoaching MVP, dịch vụ phân tích AI (sử dụng{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{providerName}</span>)
          chỉ nhận các thông tin rèn luyện trong phạm vi được bạn đồng ý:
        </p>
        <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
          <li><strong>Hồ sơ & mục tiêu:</strong> Lịch tập ưu tiên, dụng cụ hiện có, mục tiêu rèn luyện đang kích hoạt.</li>
          <li><strong>Hoạt động rèn luyện:</strong> Môn tập, thời lượng, mức mệt, thời điểm thực hiện và ghi chú buổi tập do bạn tự nhập.</li>
          <li><strong>Chỉ số quan sát thể chất:</strong> Số đo chiều cao và cân nặng bạn tự ghi nhận theo thời gian.</li>
          <li><strong>Hỏi đáp & hội thoại:</strong> Câu hỏi của bạn và lịch sử trao đổi đa lượt trong phiên hỏi đáp.</li>
        </ul>
        <div className="p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-lg text-[10px] text-amber-800 dark:text-amber-300">
          <strong>Lưu ý về nội dung tự nhập:</strong> Câu hỏi và ghi chú tự do sẽ được gửi nguyên văn đến nhà cung cấp AI. Vui lòng không nhập họ tên thật, email, số điện thoại, mật khẩu hay thông tin bệnh án nhạy cảm vào các ô nhập liệu.
        </div>
        <p className="text-[10px] text-slate-500">
          Chính sách nhà cung cấp: Yêu cầu được gửi qua Google Gemini API theo gói trả phí chuẩn (Paid Tier), cam kết không lưu giữ dữ liệu để huấn luyện mô hình cơ bản và tuân thủ Google Cloud Data Governance &amp; Privacy Terms.
        </p>
      </div>

      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[10px] text-slate-500 space-y-1">
        <div className="flex items-center justify-between">
          <span>Phiên bản đồng ý:</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
            {CURRENT_CONSENT_VERSION}
          </span>
        </div>
        {consent?.granted_at && (
          <div className="flex items-center justify-between">
            <span>Ngày chấp thuận:</span>
            <span>{formatDateVN(consent.granted_at)}</span>
          </div>
        )}
        {consent?.revoked_at && (
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span>Đã rút lại ngày:</span>
            <span>{formatDateVN(consent.revoked_at)}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div>
        {isGranted ? (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="w-full py-2 bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/40 text-slate-700 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-300 font-medium text-xs rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
            <span>Rút lại quyền chia sẻ dữ liệu</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGrant}
            disabled={isPending}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Đồng ý và kích hoạt tính năng AI</span>
          </button>
        )}
      </div>
    </section>
  );
}
