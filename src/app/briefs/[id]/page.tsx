'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  FileText,
  ArrowLeft,
  Share2,
  Calendar,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  createShareLinkAction,
  revokeShareLinkAction,
} from '@/features/briefs/server/briefs-actions';
import { BriefSnapshotPayload } from '@/features/briefs/contracts/briefs.contract';
import { createBrowserClient } from '@supabase/ssr';

export default function BriefDetailPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Share link state
  const [durationDays, setDurationDays] = useState<'1' | '7' | '30'>('7');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [isRevoking, setIsRevoking] = useState(false);

  const loadBrief = async () => {
    try {
      setLoading(true);
      // Dùng browser Supabase client để fetch brief của user hiện tại
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from('health_briefs')
        .select('*, brief_shares(*)')
        .eq('id', briefId)
        .maybeSingle();

      if (error || !data) {
        setLoadError(error?.message || 'Không tìm thấy bản tóm tắt hoặc bạn không có quyền.');
        setLoading(false);
        return;
      }

      setBrief(data);
      setLoading(false);
    } catch (err: any) {
      setLoadError(err.message || 'Lỗi khi tải dữ liệu');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrief();
  }, [briefId]);

  const handleCreateShare = async () => {
    setIsSharing(true);
    setShareError(null);

    const res = await createShareLinkAction({
      briefId,
      durationDays,
    });
    setIsSharing(false);

    if (!res.success || !res.data) {
      setShareError(res.error?.message || 'Có lỗi khi tạo liên kết chia sẻ.');
      return;
    }

    const fullUrl = `${window.location.origin}${res.data.shareUrl}`;
    setNewShareUrl(fullUrl);

    try {
      const qr = await QRCode.toDataURL(fullUrl, { width: 200, margin: 2 });
      setQrCodeDataUrl(qr);
    } catch {
      // Bỏ qua nếu lỗi QR
    }

    // Tải lại brief để cập nhật danh sách brief_shares
    loadBrief();
  };

  const handleRevokeShare = async () => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tất cả liên kết chia sẻ của bản tóm tắt này? Người nhận sẽ không thể truy cập nữa.')) {
      return;
    }

    setIsRevoking(true);
    const res = await revokeShareLinkAction(briefId);
    setIsRevoking(false);

    if (res.success) {
      setNewShareUrl(null);
      setQrCodeDataUrl(null);
      loadBrief();
    } else {
      alert(res.error?.message || 'Không thể thu hồi liên kết.');
    }
  };

  const handleCopyLink = () => {
    if (!newShareUrl) return;
    navigator.clipboard.writeText(newShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Đang tải thông tin bản tóm tắt...</span>
        </div>
      </div>
    );
  }

  if (loadError || !brief) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 text-center space-y-4">
        <div className="text-red-500 font-bold">{loadError || 'Không tìm thấy bản tóm tắt'}</div>
        <Link href="/briefs" className="text-blue-600 text-xs hover:underline">
          &larr; Quay lại danh sách
        </Link>
      </div>
    );
  }

  const snapshot: BriefSnapshotPayload = brief.snapshot_payload;
  const activeShares = (brief.brief_shares || []).filter(
    (s: any) => !s.revoked_at && new Date(s.expires_at) > new Date()
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/briefs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về Danh sách tóm tắt</span>
          </Link>
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 rounded-full">
            Snapshot ID: {brief.id.slice(0, 8)}
          </span>
        </div>

        {/* Tiêu đề & Thông tin cơ bản */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                brief.brief_type === 'workout'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
              }`}
            >
              {brief.brief_type === 'workout' ? 'Mẫu tập luyện' : 'Mẫu đi khám'}
            </span>
            <span className="text-xs text-slate-400">
              Tạo lúc {new Date(brief.created_at).toLocaleString('vi-VN')}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{brief.title}</h1>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              Kỳ ghi nhận: {brief.date_range_start} &rarr; {brief.date_range_end}
            </span>
          </div>
        </div>

        {/* MỤC CHIA SẺ BẢN TÓM TẮT (SHARE MANAGEMENT) */}
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Chia sẻ bản tóm tắt có thời hạn (Opt-in)
              </h3>
            </div>
            {activeShares.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Đang có {activeShares.length} liên kết hiệu lực</span>
              </span>
            )}
          </div>

          {/* Form tạo link chia sẻ mới */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Thời hạn của liên kết:
                </span>
                <p className="text-[11px] text-slate-500">
                  Sau thời hạn này, người nhận sẽ không thể truy cập được nữa.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value as any)}
                  className="p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="1">24 giờ (1 ngày)</option>
                  <option value="7">7 ngày</option>
                  <option value="30">30 ngày</option>
                </select>

                <button
                  type="button"
                  disabled={isSharing}
                  onClick={handleCreateShare}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-sm shrink-0"
                >
                  {isSharing ? 'Đang tạo...' : 'Tạo liên kết'}
                </button>
              </div>
            </div>

            {shareError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg">{shareError}</div>
            )}

            {/* Hiển thị Link và QR vừa tạo */}
            {newShareUrl && (
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between">
                  <span>Liên kết bảo mật dành cho người nhận:</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                    (Chỉ cấp 1 lần, server chỉ lưu hash)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newShareUrl}
                    className="flex-1 p-2 bg-white dark:bg-slate-800 text-xs border border-blue-300 dark:border-blue-700 rounded-lg select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>

                {qrCodeDataUrl && (
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code chia sẻ"
                      className="w-32 h-32 bg-white p-2 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm"
                    />
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="font-bold">Quét QR bằng điện thoại:</div>
                      <p className="text-[11px] text-slate-500">
                        HLV hoặc bác sĩ có thể quét mã QR này để mở trực tiếp bản tóm tắt trên thiết bị của họ mà không cần đăng nhập.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nút Thu hồi liên kết */}
            {activeShares.length > 0 && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Thu hồi sẽ lập tức vô hiệu hóa mọi liên kết chia sẻ trước đó.</span>
                </div>
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={handleRevokeShare}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-all"
                >
                  {isRevoking ? 'Đang thu hồi...' : 'Thu hồi toàn bộ liên kết'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* NỘI DUNG SNAPSHOT BẤT BIẾN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Nội dung Snapshot bất biến
            </h3>
            <span className="text-[11px] text-slate-400">
              {snapshot.sourceRefs.length} bản ghi nguồn
            </span>
          </div>

          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {snapshot.overview.activitySessionCount}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Số buổi tập</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {snapshot.overview.totalActivityMinutes}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Tổng phút tập</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {snapshot.overview.averageSleepMinutes
                  ? `${(snapshot.overview.averageSleepMinutes / 60).toFixed(1)}h`
                  : 'N/A'}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Ngủ TB/đêm</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                {snapshot.overview.missingDaysCount}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Ngày thiếu dữ liệu</div>
            </div>
          </div>

          {/* User Notes */}
          {brief.user_notes && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Ghi chú cho người nhận:</div>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                &ldquo;{brief.user_notes}&rdquo;
              </p>
            </div>
          )}

          {/* Sessions List */}
          {snapshot.workoutDetails?.sessions && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Các buổi tập ({snapshot.workoutDetails.sessions.length}):
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {snapshot.workoutDetails.sessions.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.date}:</span>
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">
                        {s.activityType}
                      </span>
                      <span className="text-slate-500">{s.durationMinutes} phút</span>
                    </div>
                    {s.fatigueLevel && (
                      <span className="text-[11px] text-slate-500">RPE: {s.fatigueLevel}/10</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
