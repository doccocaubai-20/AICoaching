'use server';

/**
 * CALISCOACHING MVP - SERVER ACTIONS TƯƠNG TÁC AI (AGENT E)
 * Quản lý đồng ý chia sẻ dữ liệu (Consent), tạo tóm tắt hồ sơ và hỏi đáp đa lượt.
 *
 * NGUYÊN TẮC BẢO MẬT & KIẾN TRÚC:
 * 1. Kiểm tra requireAuthenticatedUser() trong mọi Server Action.
 * 2. Kiểm tra trạng thái đồng ý (Consent) còn hiệu lực và thực thi phạm vi scope trước khi gửi dữ liệu.
 * 3. Client chỉ có quyền đọc/xóa bảng ai_summaries và ai_messages qua RLS.
 *    Thao tác ghi ai_summaries và ai_messages CHỈ ĐƯỢC PHÉP thực hiện ở Server
 *    bằng createAdminSupabaseClient() với user_id lấy từ phiên xác thực.
 * 4. Lọc bỏ toàn bộ ID tham chiếu không thuộc tập bản ghi gửi đi (chống hallucination).
 * 5. Kích hoạt fallback mẫu rõ nhãn "Mẫu tổng hợp (Không dùng AI)" khi lỗi hoặc thiếu cấu hình.
 * 6. Lỗi truy vấn dữ liệu không bao giờ được coi là dữ liệu trống.
 */

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/server/auth-guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  CURRENT_CONSENT_VERSION,
  ConsentScopeItem,
  AIConsentEntity,
  AISummaryEntity,
  AISummaryStatus,
  Json,
} from '@/contracts';
import { buildAIContext, filterValidReferences } from '@/lib/ai/context';
import { generateTemplateSummary } from '@/lib/ai/template-fallback';
import { getAIAdapter } from '@/lib/ai/factory';
import { AIReferenceSourceItem, AISummaryOutput } from '@/lib/ai/types';
import {
  computeProfileMetrics,
  verifyAITrendHighlights,
  generateTemplateTrendAnalysis,
  AITrendOutput,
} from '@/lib/ai/trend-analysis';
import { buildConversationHistory } from '@/lib/ai/history';

const VALID_CONSENT_SCOPES: ConsentScopeItem[] = ['profile', 'goals', 'activities', 'observations'];

/**
 * Kiểm tra trạng thái đồng ý chia sẻ dữ liệu của người dùng và trả về scope đã đồng ý.
 */
async function checkUserActiveConsent(
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<{ hasConsent: boolean; scope: ConsentScopeItem[] }> {
  if (!supabase) return { hasConsent: false, scope: [] };
  const { data, error } = await supabase
    .from('ai_consents')
    .select('id, is_granted, revoked_at, consent_version, scope')
    .eq('user_id', userId)
    .eq('is_granted', true)
    .is('revoked_at', null)
    .eq('consent_version', CURRENT_CONSENT_VERSION)
    .maybeSingle();

  if (error || !data) {
    return { hasConsent: false, scope: [] };
  }

  const rawScope = Array.isArray(data.scope) ? data.scope : [];
  const scope = rawScope.filter((s): s is ConsentScopeItem =>
    VALID_CONSENT_SCOPES.includes(s as ConsentScopeItem)
  );

  return { hasConsent: true, scope };
}

/**
 * Cấp quyền đồng ý chia sẻ dữ liệu với AI.
 * Kiểm tra tính hợp lệ của từng phần tử trong scope.
 */
export async function grantConsentAction(
  scope?: ConsentScopeItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    const defaultScope = scope && scope.length > 0 ? scope : VALID_CONSENT_SCOPES;

    // Kiểm tra từng phần tử scope thuộc VALID_CONSENT_SCOPES
    for (const s of defaultScope) {
      if (!VALID_CONSENT_SCOPES.includes(s)) {
        return { success: false, error: `Phạm vi đồng ý không hợp lệ: ${s}` };
      }
    }

    // Kiểm tra xem đã có bản ghi consent chưa
    const { data: existing, error: findErr } = await supabase
      .from('ai_consents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (findErr) {
      return { success: false, error: 'Không tải được dữ liệu hồ sơ, thử lại sau' };
    }

    if (existing) {
      const { error } = await supabase
        .from('ai_consents')
        .update({
          is_granted: true,
          revoked_at: null,
          consent_version: CURRENT_CONSENT_VERSION,
          scope: defaultScope,
          granted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', user.id);

      if (error) {
        return { success: false, error: `Lỗi cập nhật đồng ý: ${error.message}` };
      }
    } else {
      const { error } = await supabase.from('ai_consents').insert({
        user_id: user.id,
        is_granted: true,
        revoked_at: null,
        consent_version: CURRENT_CONSENT_VERSION,
        scope: defaultScope,
        granted_at: new Date().toISOString(),
      });

      if (error) {
        return { success: false, error: `Lỗi tạo đồng ý: ${error.message}` };
      }
    }

    revalidatePath('/ai');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return { success: false, error: message };
  }
}

/**
 * Rút lại đồng ý chia sẻ dữ liệu với AI.
 * Lập tức chặn mọi yêu cầu gọi AI tiếp theo ở tầng Server.
 */
export async function revokeConsentAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    const { error } = await supabase
      .from('ai_consents')
      .update({
        is_granted: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: `Lỗi rút đồng ý: ${error.message}` };
    }

    revalidatePath('/ai');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return { success: false, error: message };
  }
}

/**
 * Tạo tóm tắt hồ sơ rèn luyện (Tác vụ 1).
 * Sử dụng AI thật nếu có cấu hình; tự động fallback về mẫu thuần TS nếu thiếu key hoặc AI lỗi.
 */
export async function generateAISummaryAction(): Promise<{
  success: boolean;
  summary?: AISummaryEntity;
  isFallback?: boolean;
  error?: string;
}> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    // 1. BẮT BUỘC: Kiểm tra quyền đồng ý của người dùng và lấy scope
    const { hasConsent, scope } = await checkUserActiveConsent(supabase, user.id);
    if (!hasConsent || scope.length === 0) {
      return {
        success: false,
        error: 'Bạn cần cấp quyền đồng ý chia sẻ dữ liệu trước khi yêu cầu tạo tóm tắt.',
      };
    }

    // 2. Thu thập dữ liệu rèn luyện 7 ngày gần nhất (chặn cả cận trên dateTo để loại hoạt động tương lai)
    const dateTo = new Date().toISOString();
    const dateFrom = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [profileRes, goalsRes, activitiesRes, obsRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_at', dateFrom)
        .lte('start_at', dateTo)
        .order('start_at', { ascending: false }),
      supabase
        .from('observations')
        .select('*')
        .eq('user_id', user.id)
        .gte('observed_at', dateFrom)
        .lte('observed_at', dateTo)
        .order('observed_at', { ascending: false }),
      supabase.from('review_suggestions').select('*').eq('user_id', user.id),
    ]);

    // BẮT BUỘC: Kiểm tra lỗi tải dữ liệu của từng truy vấn
    if (
      profileRes.error ||
      goalsRes.error ||
      activitiesRes.error ||
      obsRes.error ||
      reviewsRes.error
    ) {
      return { success: false, error: 'Không tải được dữ liệu hồ sơ, thử lại sau' };
    }

    // 3. Dựng ngữ cảnh tối thiểu (áp dụng scope đã đồng ý)
    const { context, allowedRecordIds } = buildAIContext({
      profile: profileRes.data,
      goals: goalsRes.data || [],
      activities: activitiesRes.data || [],
      observations: obsRes.data || [],
      reviewSuggestions: reviewsRes.data || [],
      dateWindow: { from: dateFrom, to: dateTo },
      scope,
    });

    // 4. Quyết định gọi AI hay Fallback
    const adapter = getAIAdapter();
    let summaryOutput: AISummaryOutput;
    let status: AISummaryStatus = 'ai_generated';

    if (!adapter) {
      // Khi chưa cấu hình nhà cung cấp thật (chỉ dùng template_fallback)
      summaryOutput = generateTemplateSummary(context);
      status = 'template_fallback';
    } else {
      try {
        summaryOutput = await adapter.summarize(context);
      } catch (aiErr) {
        // Gặp lỗi mạng hoặc AI provider: tự động fallback an toàn
        summaryOutput = generateTemplateSummary(context);
        status = 'template_fallback';
      }
    }

    // 5. Lọc ID tham chiếu hợp lệ (chống ảo giác ID)
    let { validReferences } = filterValidReferences(summaryOutput.references, allowedRecordIds);

    // Nếu ngữ cảnh có bản ghi nhưng AI không trích dẫn được bản ghi hợp lệ nào (ảo giác hoàn toàn)
    const hasInputRecords = allowedRecordIds.size > 0;
    if (hasInputRecords && validReferences.length === 0 && status === 'ai_generated') {
      summaryOutput = generateTemplateSummary(context);
      status = 'template_fallback';
      const fallbackFiltered = filterValidReferences(summaryOutput.references, allowedRecordIds);
      validReferences = fallbackFiltered.validReferences;
    }

    // 6. Ghi vào database bằng Admin Client (do RLS revoke insert/update từ authenticated)
    const adminClient = createAdminSupabaseClient();
    if (!adminClient) {
      return {
        success: false,
        error: 'Chưa cấu hình Supabase Service Role Key để lưu trữ bản tóm tắt.',
      };
    }

    const { data: insertedSummary, error: insertError } = await adminClient
      .from('ai_summaries')
      .insert({
        user_id: user.id,
        input_scope: {
          start_date: context.date_window.from,
          end_date: context.date_window.to,
        },
        status,
        content: summaryOutput.summary,
        missing_data_notes:
          summaryOutput.missing_data.length > 0 ? summaryOutput.missing_data.join('; ') : null,
        reference_record_ids: validReferences.map((r) => r.id),
        is_demo: false,
      })
      .select('*')
      .single();

    if (insertError || !insertedSummary) {
      return {
        success: false,
        error: `Không thể lưu bản tóm tắt: ${insertError?.message || 'Lỗi không xác định'}`,
      };
    }

    revalidatePath('/ai');
    revalidatePath('/dashboard');

    return {
      success: true,
      summary: insertedSummary as unknown as AISummaryEntity,
      isFallback: status === 'template_fallback',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return { success: false, error: message };
  }
}

/**
 * Gửi câu hỏi đến AI theo hồ sơ rèn luyện (Tác vụ 2).
 * Đa lượt đối thoại, từ chối y khoa, trích dẫn ID bản ghi, không bịa đặt.
 */
export async function askAIQuestionAction(
  conversationId: string | undefined,
  question: string
): Promise<{
  success: boolean;
  conversationId?: string;
  answer?: string;
  references?: AIReferenceSourceItem[];
  isOutOfScope?: boolean;
  error?: string;
}> {
  try {
    const trimmedQuestion = (question || '').trim();
    if (!trimmedQuestion || trimmedQuestion.length < 2) {
      return { success: false, error: 'Vui lòng nhập câu hỏi rõ ràng (tối thiểu 2 ký tự).' };
    }

    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    // 1. Kiểm tra quyền đồng ý của người dùng và lấy scope
    const { hasConsent, scope } = await checkUserActiveConsent(supabase, user.id);
    if (!hasConsent || scope.length === 0) {
      return {
        success: false,
        error: 'Bạn cần cấp quyền đồng ý chia sẻ dữ liệu trước khi gửi câu hỏi tới AI.',
      };
    }

    // 2. Xác thực hoặc khởi tạo cuộc hội thoại (ai_conversations)
    let activeConversationId = conversationId;
    if (activeConversationId) {
      const { data: conv, error: convErr } = await supabase
        .from('ai_conversations')
        .select('id, user_id')
        .eq('id', activeConversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (convErr || !conv) {
        return {
          success: false,
          error: 'Cuộc trò chuyện không tồn tại hoặc không thuộc quyền sở hữu của bạn.',
        };
      }
    } else {
      const { data: newConv, error: newConvErr } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: trimmedQuestion.slice(0, 40),
        })
        .select('*')
        .single();

      if (newConvErr || !newConv) {
        return {
          success: false,
          error: `Không thể tạo cuộc hội thoại mới: ${newConvErr?.message}`,
        };
      }
      activeConversationId = newConv.id;
    }

    const adminClient = createAdminSupabaseClient();
    if (!adminClient) {
      return {
        success: false,
        error: 'Chưa cấu hình Supabase Service Role Key để xử lý tin nhắn.',
      };
    }

    // 3. Lấy 6 tin nhắn mới nhất TRƯỚC KHI ghi tin nhắn mới (chỉ lấy status = 'completed')
    // Sắp xếp giảm dần, limit(6), rồi đảo lại theo thời gian
    const { data: rawHistory, error: historyErr } = await supabase
      .from('ai_messages')
      .select('id, role, content, status')
      .eq('conversation_id', activeConversationId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(6);

    if (historyErr) {
      return {
        success: false,
        conversationId: activeConversationId,
        error: 'Không tải được dữ liệu hồ sơ, thử lại sau',
      };
    }

    const sortedHistory = (rawHistory || []).reverse();
    const messageHistory = buildConversationHistory(sortedHistory, undefined, scope);

    // 4. Ghi tin nhắn của User vào ai_messages và KIỂM TRA LỖI
    const { error: userMsgErr } = await adminClient.from('ai_messages').insert({
      conversation_id: activeConversationId,
      user_id: user.id,
      role: 'user',
      content: trimmedQuestion,
      reference_sources: [],
      status: 'completed',
    });

    if (userMsgErr) {
      return {
        success: false,
        conversationId: activeConversationId,
        error: `Không thể ghi nhận tin nhắn của bạn: ${userMsgErr.message}`,
      };
    }

    // 5. Thu thập dữ liệu rèn luyện để dựng context (kiểm tra lỗi từng truy vấn, chặn cả cận trên dateTo)
    const dateTo = new Date().toISOString();
    const dateFrom = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    const [profileRes, goalsRes, activitiesRes, obsRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_at', dateFrom)
        .lte('start_at', dateTo)
        .order('start_at', { ascending: false }),
      supabase
        .from('observations')
        .select('*')
        .eq('user_id', user.id)
        .gte('observed_at', dateFrom)
        .lte('observed_at', dateTo)
        .order('observed_at', { ascending: false }),
      supabase.from('review_suggestions').select('*').eq('user_id', user.id),
    ]);

    if (
      profileRes.error ||
      goalsRes.error ||
      activitiesRes.error ||
      obsRes.error ||
      reviewsRes.error
    ) {
      return {
        success: false,
        conversationId: activeConversationId,
        error: 'Không tải được dữ liệu hồ sơ, thử lại sau',
      };
    }

    const { context, allowedRecordIds } = buildAIContext({
      profile: profileRes.data,
      goals: goalsRes.data || [],
      activities: activitiesRes.data || [],
      observations: obsRes.data || [],
      reviewSuggestions: reviewsRes.data || [],
      dateWindow: { from: dateFrom, to: dateTo },
      scope,
    });

    // 6. Gọi AI Adapter (nếu không có adapter thật -> báo "AI chưa được cấu hình")
    const adapter = getAIAdapter();
    if (!adapter) {
      return {
        success: false,
        conversationId: activeConversationId,
        error: 'AI chưa được cấu hình',
      };
    }

    try {
      const answerOutput = await adapter.answer(context, trimmedQuestion, messageHistory);
      const { validReferences } = filterValidReferences(answerOutput.references, allowedRecordIds);

      // Nếu ngữ cảnh có bản ghi và câu hỏi không out_of_scope nhưng AI không trích dẫn được bản ghi nào
      const hasInputRecords = allowedRecordIds.size > 0;
      if (hasInputRecords && validReferences.length === 0 && !answerOutput.out_of_scope) {
        const failMsg = 'Câu trả lời từ AI không thể đối chiếu với bản ghi thực tế nào trong nhật ký của bạn.';
        await adminClient.from('ai_messages').insert({
          conversation_id: activeConversationId,
          user_id: user.id,
          role: 'assistant',
          content: failMsg,
          reference_sources: [],
          status: 'failed',
        });

        revalidatePath('/ai');
        return {
          success: false,
          conversationId: activeConversationId,
          error: failMsg,
        };
      }

      const { error: assistantInsertErr } = await adminClient.from('ai_messages').insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role: 'assistant',
        content: answerOutput.answer,
        reference_sources: validReferences as unknown as Json,
        status: 'completed',
      });

      if (assistantInsertErr) {
        return {
          success: false,
          conversationId: activeConversationId,
          error: `Không thể lưu câu trả lời của trợ lý: ${assistantInsertErr.message}`,
        };
      }

      revalidatePath('/ai');
      return {
        success: true,
        conversationId: activeConversationId,
        answer: answerOutput.answer,
        references: validReferences,
        isOutOfScope: answerOutput.out_of_scope,
      };
    } catch (aiErr: unknown) {
      const isRateLimit =
        aiErr instanceof Error && aiErr.message.includes('AI đang quá tải, thử lại sau');
      const failMsg = isRateLimit
        ? 'AI đang quá tải, thử lại sau'
        : 'Đã xảy ra sự cố khi kết nối với mô hình AI. Vui lòng thử lại sau giây lát.';

      await adminClient.from('ai_messages').insert({
        conversation_id: activeConversationId,
        user_id: user.id,
        role: 'assistant',
        content: failMsg,
        reference_sources: [],
        status: 'failed',
      });

      revalidatePath('/ai');
      return {
        success: false,
        conversationId: activeConversationId,
        error: failMsg,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return { success: false, error: message };
  }
}

/**
 * Xóa một cuộc trò chuyện và toàn bộ tin nhắn liên quan.
 */
export async function deleteConversationAction(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: `Lỗi xóa cuộc trò chuyện: ${error.message}` };
    }

    revalidatePath('/ai');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return { success: false, error: message };
  }
}

/**
 * Xóa một bản tóm tắt hồ sơ do AI hoặc template tạo.
 */
export async function deleteAISummaryAction(
  summaryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    const { error } = await supabase
      .from('ai_summaries')
      .delete()
      .eq('id', summaryId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: `Lỗi xóa bản tóm tắt: ${error.message}` };
    }

    revalidatePath('/ai');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return { success: false, error: message };
  }
}

/**
 * Phân tích xu hướng hồ sơ rèn luyện P1 (chu kỳ 4 tuần hoặc 8 tuần).
 * Nguyên tắc: Số liệu do mã TypeScript tính thuần, AI chỉ diễn giải, Server kiểm tra số và ID.
 */
export async function analyzeProfileTrendsAction(
  weeks: 4 | 8 = 4
): Promise<{
  success: boolean;
  summary?: AISummaryEntity;
  isFallback?: boolean;
  error?: string;
}> {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Chưa cấu hình Supabase credentials' };
    }

    // 1. BẮT BUỘC: Kiểm tra quyền đồng ý của người dùng và lấy scope
    const { hasConsent, scope } = await checkUserActiveConsent(supabase, user.id);
    if (!hasConsent || scope.length === 0) {
      return {
        success: false,
        error: 'Bạn cần cấp quyền đồng ý chia sẻ dữ liệu trước khi phân tích xu hướng.',
      };
    }

    // 2. Thu thập dữ liệu rèn luyện trong khoảng thời gian weeks (chặn cả cận trên)
    const now = new Date();
    const toDateIso = now.toISOString();
    const startTimeMs = now.getTime() - weeks * 7 * 24 * 3600 * 1000;
    const fromDateIso = new Date(startTimeMs).toISOString();

    const [profileRes, goalsRes, activitiesRes, obsRes, sessionResultsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_at', fromDateIso)
        .lte('start_at', toDateIso)
        .order('start_at', { ascending: false }),
      supabase
        .from('observations')
        .select('*')
        .eq('user_id', user.id)
        .gte('observed_at', fromDateIso)
        .lte('observed_at', toDateIso)
        .order('observed_at', { ascending: false }),
      supabase
        .from('session_results')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', fromDateIso)
        .lte('completed_at', toDateIso),
    ]);

    // BẮT BUỘC: Kiểm tra lỗi tải dữ liệu
    if (
      profileRes.error ||
      goalsRes.error ||
      activitiesRes.error ||
      obsRes.error ||
      sessionResultsRes.error
    ) {
      return { success: false, error: 'Không tải được dữ liệu hồ sơ, thử lại sau' };
    }

    // 3. Tính toán toàn bộ chỉ số bằng hàm thuần TypeScript (áp dụng scope)
    const metrics = computeProfileMetrics({
      profile: profileRes.data,
      goals: goalsRes.data || [],
      activities: activitiesRes.data || [],
      observations: obsRes.data || [],
      sessionResults: sessionResultsRes.data || [],
      weeks,
      now,
      scope,
    });

    // 4. Quyết định gọi AI hay Fallback
    const adapter = getAIAdapter();
    let trendOutput: AITrendOutput;
    let status: AISummaryStatus = 'ai_generated';

    if (!adapter || !adapter.analyzeTrends) {
      trendOutput = generateTemplateTrendAnalysis(metrics);
      status = 'template_fallback';
    } else {
      try {
        trendOutput = await adapter.analyzeTrends(metrics);
      } catch (aiErr) {
        trendOutput = generateTemplateTrendAnalysis(metrics);
        status = 'template_fallback';
      }
    }

    // 5. Kiểm tra và loại bỏ các điểm số liệu sai hoặc ID lạ
    const { validHighlights } = verifyAITrendHighlights(
      trendOutput.highlights,
      metrics,
      new Set(metrics.allowed_record_ids)
    );

    // 6. Ghi vào ai_summaries bằng adminClient
    const adminClient = createAdminSupabaseClient();
    if (!adminClient) {
      return {
        success: false,
        error: 'Chưa cấu hình Supabase Service Role Key để lưu trữ phân tích.',
      };
    }

    const validReferenceIds = Array.from(
      new Set(validHighlights.flatMap((h) => h.references.map((r) => r.id)))
    );

    const { data: insertedSummary, error: insertError } = await adminClient
      .from('ai_summaries')
      .insert({
        user_id: user.id,
        input_scope: {
          kind: 'analysis',
          weeks,
          metrics: metrics as unknown as Json,
        },
        status,
        content: JSON.stringify({
          highlights: validHighlights,
          missing_data: trendOutput.missing_data,
          period: metrics.period,
        }),
        missing_data_notes:
          trendOutput.missing_data.length > 0 ? trendOutput.missing_data.join('; ') : null,
        reference_record_ids: validReferenceIds,
        is_demo: false,
      })
      .select('*')
      .single();

    if (insertError || !insertedSummary) {
      return {
        success: false,
        error: `Không thể lưu bản phân tích xu hướng: ${insertError?.message || 'Lỗi không xác định'}`,
      };
    }

    revalidatePath('/ai');
    revalidatePath('/dashboard');

    return {
      success: true,
      summary: insertedSummary as unknown as AISummaryEntity,
      isFallback: status === 'template_fallback',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
    return { success: false, error: message };
  }
}
