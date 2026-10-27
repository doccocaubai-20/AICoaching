/**
 * CALISCOACHING MVP - BỘ SINH TÓM TẮT DỰ PHÒNG THEO MẪU (AGENT E)
 * Thuần TypeScript, không gọi dịch vụ ngoài, kích hoạt khi chưa có cấu hình AI hoặc khi AI gặp lỗi.
 * Nhãn quy định rõ ràng: "Mẫu tổng hợp (Không dùng AI)".
 */

import { AIContextPayload, AISummaryOutput, AIReferenceSourceItem } from './types';
import { ACTIVITY_TYPE_LABELS } from '@/components/activities/activity-utils';

export function generateTemplateSummary(context: AIContextPayload): AISummaryOutput {
  const completedActivities = context.activities.filter((a) => !a.is_planned);
  const totalMinutes = completedActivities.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const totalSessions = completedActivities.length;

  const sportTypes = Array.from(new Set(completedActivities.map((a) => a.activity_type)));
  const sportNames = sportTypes.map((t) => ACTIVITY_TYPE_LABELS[t] || t).join(', ');

  const activeGoals = context.goals.filter((g) => g.status === 'active');

  const missingData: string[] = [];

  // Kiểm tra chỉ số cơ thể
  const hasWeight = context.observations.some((o) => o.metric_type === 'weight');
  const hasHeight = context.observations.some((o) => o.metric_type === 'height');

  if (!hasWeight) {
    missingData.push('Chưa ghi nhận cân nặng trong tuần');
  }
  if (!hasHeight) {
    missingData.push('Chưa có thông tin chiều cao');
  }

  // Kiểm tra ghi chú hoặc mức mệt
  const missingFatigueCount = completedActivities.filter((a) => a.fatigue_level == null).length;
  if (missingFatigueCount > 0) {
    missingData.push(`Có ${missingFatigueCount} buổi tập chưa ghi nhận mức mệt (RPE)`);
  }

  if (totalSessions === 0) {
    missingData.push('Chưa có buổi tập thực tế nào được ghi nhận trong khoảng thời gian này');
  }

  // Thu thập ID tham chiếu
  const references: AIReferenceSourceItem[] = [];
  for (const a of completedActivities) {
    references.push({
      type: 'activity',
      id: a.id,
      description: `${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type} (${a.duration_minutes} phút)`,
    });
  }
  for (const g of activeGoals) {
    references.push({
      type: 'goal',
      id: g.id,
      description: `Mục tiêu: ${g.content}`,
    });
  }

  // Dựng văn bản tóm tắt
  let text = `[Mẫu tổng hợp (Không dùng AI)] Báo cáo vận động từ ngày ${context.date_window.from} đến ngày ${context.date_window.to}:\n\n`;

  if (totalSessions === 0) {
    text += `• Quá trình rèn luyện: Chưa ghi nhận buổi tập hoàn thành nào trong 7 ngày gần nhất.\n`;
  } else {
    text += `• Quá trình rèn luyện: Bạn đã hoàn thành ${totalSessions} buổi tập với tổng thời gian ${totalMinutes} phút.`;
    if (sportNames) {
      text += ` Các bộ môn đã tham gia: ${sportNames}.\n`;
    } else {
      text += `\n`;
    }
  }

  if (activeGoals.length > 0) {
    text += `• Mục tiêu đang thực hiện: ${activeGoals.map((g) => `"${g.content}"`).join(', ')}.\n`;
  } else {
    text += `• Mục tiêu: Hiện bạn chưa thiết lập mục tiêu tập luyện đang hoạt động nào.\n`;
  }

  if (missingData.length > 0) {
    text += `• Lưu ý dữ liệu: ${missingData.join('; ')}.\n`;
  }

  text += `\n(Ghi chú: Đây là bản tổng hợp tự động theo mẫu dựa trên nhật ký của bạn, không sử dụng mô hình AI và không thay thế tư vấn chuyên môn).`;

  return {
    summary: text,
    period: {
      from: context.date_window.from,
      to: context.date_window.to,
    },
    references,
    missing_data: missingData,
  };
}
