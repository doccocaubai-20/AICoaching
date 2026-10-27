'use client';

/**
 * CALISCOACHING MVP - HỘI THOẠI HỎI ĐÁP AI THEO HỒ SƠ (AGENT E)
 * Hỏi đáp tiếng Việt đa lượt dựa DUY NHẤT trên dữ liệu nhật ký rèn luyện.
 * Không bịa đặt, từ chối y khoa, trích dẫn ID bản ghi, không dùng câu trả lời giả khi lỗi.
 */

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BotMessageSquare,
  Send,
  User,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AIConversationEntity, AIMessageEntity } from '@/contracts';
import { askAIQuestionAction, deleteConversationAction } from '@/app/ai/actions';
import { formatDateVN } from '@/components/dashboard/date-utils';
import { AIReferenceSourceItem } from '@/lib/ai/types';

interface AIChatBoxProps {
  activeConversation: AIConversationEntity | null;
  messages: AIMessageEntity[];
  hasConsent: boolean;
}

const QUICK_QUESTIONS = [
  'Tuần này tôi đã tập bao nhiêu phút?',
  'Môn nào tôi dành nhiều thời gian nhất?',
  'Mục tiêu tập luyện hiện tại của tôi là gì?',
  'Tôi đã hoàn thành bao nhiêu buổi calisthenics?',
];

export function AIChatBox({ activeConversation, messages, hasConsent }: AIChatBoxProps) {
  const [question, setQuestion] = useState('');
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending]);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || question).trim();
    if (!query || isPending || !hasConsent) return;

    setErrorMsg(null);
    setQuestion('');

    startTransition(async () => {
      const res = await askAIQuestionAction(activeConversation?.id, query);
      if (!res.success) {
        setErrorMsg(res.error || 'Đã xảy ra lỗi khi gửi câu hỏi tới AI');
      }
    });
  };

  const handleRetry = (failedQuestion: string) => {
    handleSend(failedQuestion);
  };

  const handleDeleteConversation = () => {
    if (!activeConversation) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ cuộc trò chuyện này?')) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteConversationAction(activeConversation.id);
      if (!res.success) {
        setErrorMsg(res.error || 'Không thể xóa cuộc trò chuyện');
      }
    });
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <BotMessageSquare className="w-4 h-4 text-purple-600" />
          <span>Hỏi đáp nhật ký rèn luyện</span>
        </div>
        {activeConversation && (
          <button
            type="button"
            onClick={handleDeleteConversation}
            disabled={isPending}
            className="text-[10px] text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 disabled:opacity-50"
            title="Xóa toàn bộ cuộc trò chuyện"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa hội thoại</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Đặt câu hỏi bằng tiếng Việt về số buổi tập, thời lượng, mục tiêu và chỉ số của bạn. AI chỉ
        trả lời dựa trên dữ liệu nhật ký thực tế và luôn trích dẫn nguồn.
      </p>

      {/* Cảnh báo miễn trừ y tế */}
      <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[10px] text-slate-500 flex items-center gap-1.5 border border-slate-100 dark:border-slate-800">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>
          CalisCoaching không đưa ra chẩn đoán y khoa, kê đơn hay kết luận phục hồi lâm sàng.
        </span>
      </div>

      {/* Hộp hiển thị tin nhắn */}
      <div className="min-h-[220px] max-h-[360px] overflow-y-auto space-y-3 p-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
        {messages.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-center p-4 space-y-2">
            <BotMessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs text-slate-400">
              Chưa có tin nhắn nào. Bạn có thể chọn câu hỏi gợi ý bên dưới để bắt đầu:
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  disabled={!hasConsent || isPending}
                  className="text-[10px] bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60 transition-colors disabled:opacity-50 text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isFailed = msg.status === 'failed';
            const references = (
              Array.isArray(msg.reference_sources) ? msg.reference_sources : []
            ) as unknown as AIReferenceSourceItem[];

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0 mt-0.5">
                    <BotMessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs space-y-1.5 ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : isFailed
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900 rounded-tl-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>

                  {/* Nút thử lại nếu bị lỗi */}
                  {isFailed && (
                    <button
                      type="button"
                      onClick={() => {
                        const precedingUserMsg = messages
                          .slice(0, index)
                          .reverse()
                          .find((m) => m.role === 'user');
                        handleRetry(precedingUserMsg?.content || '');
                      }}
                      disabled={isPending}
                      className="mt-1 text-[10px] font-semibold text-red-600 dark:text-red-300 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Thử lại câu hỏi</span>
                    </button>
                  )}

                  {/* Nguồn trích dẫn dưới câu trả lời của AI */}
                  {!isUser && !isFailed && references.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 text-[10px] space-y-1">
                      <span className="text-slate-400 dark:text-slate-500 font-medium">
                        Nguồn tham chiếu:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {references.map((ref, rIdx) => (
                          <Link
                            key={rIdx}
                            href="/activities"
                            className="font-mono text-[9px] bg-slate-100 dark:bg-slate-700 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded hover:underline flex items-center gap-0.5"
                            title={ref.description || ref.id}
                          >
                            <span>#{ref.id.slice(0, 8)}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[9px] pt-0.5 ${
                      isUser ? 'text-purple-200' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {formatDateVN(msg.created_at, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isPending && (
          <div className="flex gap-2 justify-start items-center">
            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0">
              <BotMessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-3 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
              <span>AI đang tra cứu dữ liệu nhật ký và soạn câu trả lời...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form gửi câu hỏi */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            !hasConsent
              ? 'Vui lòng cấp quyền đồng ý chia sẻ dữ liệu trước'
              : 'Đặt câu hỏi theo dữ liệu rèn luyện...'
          }
          disabled={!hasConsent || isPending}
          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!hasConsent || isPending || !question.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Gửi câu hỏi"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </section>
  );
}
