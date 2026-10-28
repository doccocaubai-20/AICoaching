'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Zap,
  Dumbbell,
  Moon,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Share2,
  Play,
  Check,
} from 'lucide-react';
import { MOCK_TRY_DATA } from '@/features/demo/try-fixtures';

export default function TryModePage() {
  const [activeTab, setActiveTab] = useState<'capture' | 'workout' | 'brief'>('capture');

  // State thử ghi nhận
  const [inputText, setInputText] = useState(MOCK_TRY_DATA.sampleSentences[0]);
  const [isParsed, setIsParsed] = useState(true);

  // State thử buổi tập
  const [currentSet, setCurrentSet] = useState(1);
  const [setFinished, setSetFinished] = useState(false);

  const handleReset = () => {
    setInputText(MOCK_TRY_DATA.sampleSentences[0]);
    setIsParsed(true);
    setCurrentSet(1);
    setSetFinished(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Banner chế độ dùng thử cách ly */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block">Trải nghiệm tương tác 2 phút (Cách ly an toàn)</span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Thao tác tại đây không lưu vào bất kỳ tài khoản nào. Bạn có thể tự do thử nghiệm.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>

        {/* Thanh chuyển đổi nhánh khám phá */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('capture')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'capture'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>1. Thử ghi câu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workout')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'workout'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            <span>2. Thử buổi tập</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brief')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'brief'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>3. Xem tóm tắt</span>
          </button>
        </div>

        {/* TAB 1: THỬ GHI CÂU TỰ NHIÊN */}
        {activeTab === 'capture' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <span>Ghi hồ sơ bằng một câu tiếng Việt</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Thay vì phải mở nhiều form riêng lẻ, bạn chỉ cần gõ một câu mô tả việc đã làm.
              </p>
            </div>

            {/* Ô nhập câu thử nghiệm */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Câu mẫu hoặc nhập thử:
              </label>
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setIsParsed(false);
                }}
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {MOCK_TRY_DATA.sampleSentences.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(sample);
                      setIsParsed(true);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition"
                  >
                    &ldquo;{sample}&rdquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Nút bấm phân tích */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsParsed(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Phân tách câu ngay
              </button>
            </div>

            {/* Kết quả phân tách minh họa */}
            {isParsed && (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <span>Kết quả phân tách tự động (Bản nháp):</span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded">
                    Xem trước an toàn
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 rounded-lg">
                      <Dumbbell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Chạy bộ · 25 phút</div>
                      <div className="text-[11px] text-slate-500">Tự động gắn vào Nhật ký hôm nay</div>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 rounded-lg">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Giấc ngủ · 6.5 giờ</div>
                      <div className="text-[11px] text-slate-500">Tự động gắn vào Sinh hoạt đêm qua</div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  * Trên ứng dụng thật, bạn có thể chỉnh sửa lại số phút hoặc mức gắng sức trước khi nhấn Xác nhận lưu.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: THỬ BUỔI TẬP CÓ TRÍ NHỚ */}
        {activeTab === 'workout' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-emerald-600" />
                <span>Buổi tập trực tiếp có bộ đếm và lưu từng hiệp</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Lưu lại số lần thực tế bạn làm được. Nếu mạng rớt hoặc tắt tab, buổi tập vẫn được ghi nhớ.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Đang tập hiệp {currentSet}/3
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Hít đất (Push-up)
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Mục tiêu: 15 lần
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Số cái thực tế hoàn thành:
                </span>
                <span className="text-sm font-black text-emerald-600">15 cái</span>
              </div>

              {!setFinished ? (
                <button
                  type="button"
                  onClick={() => setSetFinished(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Hoàn thành hiệp {currentSet} &rarr; Bắt đầu đếm nghỉ
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-2 text-center">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Đã lưu hiệp {currentSet}! Đang nghỉ hồi sức (60s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentSet < 3) {
                        setCurrentSet(currentSet + 1);
                        setSetFinished(false);
                      } else {
                        alert('Bạn đã hoàn thành trọn vẹn 3 hiệp tập mẫu!');
                        setCurrentSet(1);
                        setSetFinished(false);
                      }
                    }}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                  >
                    {currentSet < 3 ? `Bỏ qua nghỉ, sang hiệp ${currentSet + 1}` : 'Kết thúc buổi tập mẫu'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: XEM BẢN TÓM TẮT CÓ NGUỒN */}
        {activeTab === 'brief' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                <span>Hồ sơ đem đi trao đổi (Bản tóm tắt xác thực)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Tạo bản snapshot có thời hạn gửi HLV calisthenics hoặc chuẩn bị thông tin trước khi đi khám.
              </p>
            </div>

            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900 pb-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  {MOCK_TRY_DATA.briefSummaryDemo.title}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  Mẫu trao đổi HLV
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="font-black text-slate-900 dark:text-white">6 buổi</div>
                  <div className="text-[10px] text-slate-500">Trong 14 ngày</div>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="font-black text-emerald-600">195 phút</div>
                  <div className="text-[10px] text-slate-500">Tổng thời lượng</div>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="font-black text-indigo-600">7.2 giờ</div>
                  <div className="text-[10px] text-slate-500">Ngủ TB/đêm</div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-bold text-slate-800 dark:text-slate-200">Điểm nổi bật được trích xuất:</div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  {MOCK_TRY_DATA.briefSummaryDemo.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Hỗ trợ cấp link QR bảo mật có thời hạn & thu hồi tức thì</span>
                <span className="font-semibold text-blue-600">Bảo mật &rarr;</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA BẮT ĐẦU VỚI TÀI KHOẢN THẬT */}
        <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl shadow-md text-center space-y-3">
          <h3 className="text-base font-bold">Bạn đã sẵn sàng ghi lại quá trình của chính mình?</h3>
          <p className="text-xs text-emerald-100 max-w-md mx-auto">
            Tạo tài khoản miễn phí để lưu trữ nhật ký cá nhân an toàn và bắt đầu hành trình rèn luyện calisthenics ngay hôm nay.
          </p>
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-2.5 bg-white text-emerald-800 font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-50 transition flex items-center justify-center gap-1.5"
            >
              <span>Bắt đầu với dữ liệu của tôi</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="text-xs text-emerald-100 hover:text-white underline py-1"
            >
              Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
