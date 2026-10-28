import React from 'react';
import { Metadata } from 'next';
import {
  FileText,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Dumbbell,
  Stethoscope,
  Info,
} from 'lucide-react';
import { getSharedBriefAction } from '@/features/briefs/server/briefs-actions';

export const metadata: Metadata = {
  title: 'Bản tóm tắt hồ sơ chia sẻ | CalisCoaching',
  description: 'Bản tóm tắt hồ sơ tự khai được chia sẻ có thời hạn',
  robots: {
    index: false,
    follow: false,
  },
};

interface SharedBriefPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedBriefPage({ params }: SharedBriefPageProps) {
  const { token } = await params;
  const result = await getSharedBriefAction(token);

  // 1. Trường hợp Liên kết không tồn tại
  if (result.status === 'not_found') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Không tìm thấy liên kết</h2>
          <p className="text-xs text-slate-500">
            Liên kết chia sẻ không tồn tại hoặc đã bị gỡ bỏ khỏi hệ thống.
          </p>
        </div>
      </div>
    );
  }

  // 2. Trường hợp Đã bị thu hồi (Revoked)
  if (result.status === 'revoked') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-950 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Liên kết đã bị thu hồi</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chủ sở hữu hồ sơ đã chủ động thu hồi quyền truy cập của liên kết này.
          </p>
        </div>
      </div>
    );
  }

  // 3. Trường hợp Hết hạn (Expired)
  if (result.status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Liên kết đã hết hạn</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Thời hạn xem của liên kết chia sẻ này đã kết thúc. Vui lòng liên hệ người gửi để nhận liên kết mới.
          </p>
        </div>
      </div>
    );
  }

  // 4. Trường hợp Nguồn thay đổi (Stale Snapshot)
  if (result.status === 'stale') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Bản tóm tắt tạm ngừng hiển thị
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Dữ liệu nguồn (buổi tập hoặc chỉ số) đã được chỉnh sửa hoặc xóa bởi chủ sở hữu sau khi tạo bản tóm tắt này. Để đảm bảo tính chính xác, bản tóm tắt cũ đã tạm ngừng chia sẻ.
          </p>
          <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 py-2 px-3 rounded-xl">
            Vui lòng liên hệ người gửi để xuất lại bản tóm tắt cập nhật mới nhất.
          </div>
        </div>
      </div>
    );
  }

  // 5. Trường hợp ACTIVE: Hiển thị Snapshot an toàn
  const snapshot = result.snapshot!;
  const briefType = snapshot.meta.briefType;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Banner thông báo chế độ người nhận */}
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Bản tóm tắt tự khai được chia sẻ có thời hạn từ <strong>CalisCoaching</strong>
            </span>
          </div>
          {result.shareInfo?.expiresAt && (
            <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
              Hết hạn: {new Date(result.shareInfo.expiresAt).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        {/* Header Brief */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                briefType === 'workout'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
              }`}
            >
              {briefType === 'workout' ? 'Hồ sơ luyện tập' : 'Thông tin đi khám'}
            </span>
            <span className="text-xs text-slate-400">
              Snapshot ngày {new Date(snapshot.meta.generatedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {snapshot.meta.title}
          </h1>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              Giai đoạn: {snapshot.meta.dateRange.start} &rarr; {snapshot.meta.dateRange.end}
            </span>
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 italic">
            &ldquo;{snapshot.meta.disclaimer}&rdquo;
          </div>
        </div>

        {/* Chỉ số tổng quan Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {snapshot.overview.activitySessionCount}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-1">Số buổi tập</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {snapshot.overview.totalActivityMinutes}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-1">Tổng phút tập</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {snapshot.overview.averageSleepMinutes
                ? `${(snapshot.overview.averageSleepMinutes / 60).toFixed(1)}h`
                : 'N/A'}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-1">Ngủ TB/đêm</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {snapshot.overview.missingDaysCount}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-1">Ngày thiếu dữ liệu</div>
          </div>
        </div>

        {/* Ghi chú của người gửi */}
        {result.userNotes && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lời nhắn từ người gửi:
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 italic">
              &ldquo;{result.userNotes}&rdquo;
            </p>
          </div>
        )}

        {/* Chi tiết các buổi tập (Workout Details) */}
        {snapshot.workoutDetails && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-emerald-600" />
                <span>Chi tiết các buổi tập ({snapshot.workoutDetails.sessions.length})</span>
              </h3>
            </div>

            <div className="space-y-2">
              {snapshot.workoutDetails.sessions.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{s.date}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold text-[11px]">
                        {s.activityType}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-[11px] text-slate-500 italic">&ldquo;{s.notes}&rdquo;</p>
                    )}
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {s.durationMinutes} phút
                    </div>
                    {s.fatigueLevel && (
                      <div className="text-[11px] text-slate-500">RPE: {s.fatigueLevel}/10</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chi tiết Medical (nếu có) */}
        {snapshot.medicalDetails && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <span>Thông tin sức khỏe tự khai</span>
              </h3>
            </div>

            {/* Conditions */}
            {snapshot.medicalDetails.selfReportedConditions &&
              snapshot.medicalDetails.selfReportedConditions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Tình trạng & Triệu chứng:
                  </div>
                  <div className="space-y-1">
                    {snapshot.medicalDetails.selfReportedConditions.map((c, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs">
                        <span className="font-bold">{c.conditionName}</span> ({c.status})
                        {c.notes && <span className="text-slate-500 block text-[11px]">{c.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Vital Observations */}
            {snapshot.medicalDetails.vitalObservations &&
              snapshot.medicalDetails.vitalObservations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Chỉ số đo cơ thể:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {snapshot.medicalDetails.vitalObservations.map((v, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                        <div className="text-slate-500 text-[11px]">{v.metricType}</div>
                        <div className="font-bold">
                          {v.metricValue} {v.metricUnit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Footer bảo mật */}
        <div className="text-center text-[11px] text-slate-400 py-4">
          Bản tóm tắt chỉ đọc • Mã nguồn xác thực bất biến • CalisCoaching Health Highlight
        </div>
      </div>
    </div>
  );
}
