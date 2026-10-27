'use client';

import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, HeartPulse, Activity, Zap } from 'lucide-react';
import {
  DailyCheckinEntity,
  HealthConditionEntity,
  BloodPressureEntity,
  ActivityEntity,
} from '@/contracts';

interface AISynergyGuardCardProps {
  todayCheckin: DailyCheckinEntity | null;
  conditions: HealthConditionEntity[];
  latestBP: BloodPressureEntity | null;
  recentActivities?: ActivityEntity[];
}

export function AISynergyGuardCard({
  todayCheckin,
  conditions,
  latestBP,
  recentActivities = [],
}: AISynergyGuardCardProps) {
  const alerts: {
    type: 'warning' | 'caution' | 'info';
    title: string;
    description: string;
    recommendation: string;
    icon: typeof AlertTriangle;
  }[] = [];

  // 1. Kiểm tra chấn thương thể chất (Active injuries)
  const activeInjuries = conditions.filter(
    (c) => c.category === 'injury' && c.status === 'active'
  );

  activeInjuries.forEach((inj) => {
    const nameLower = inj.name.toLowerCase();
    if (nameLower.includes('vai') || nameLower.includes('shoulder')) {
      alerts.push({
        type: 'warning',
        title: `Phát hiện chấn thương: ${inj.name}`,
        description: 'Khớp vai đang trong trạng thái hồi phục, chịu tải kéo/đẩy lớn sẽ dễ tái phát.',
        recommendation:
          'Khuyến nghị: Tạm hoãn các bài hít xà nặng (Pull-up) hoặc Dips. Ưu tiên kéo xà ngang (Inverted row) chân chạm đất hoặc bài bổ trợ xoay khớp rotator cuff.',
        icon: AlertTriangle,
      });
    } else if (nameLower.includes('cổ tay') || nameLower.includes('wrist')) {
      alerts.push({
        type: 'warning',
        title: `Phát hiện chấn thương: ${inj.name}`,
        description: 'Áp lực bẻ gập cổ tay khi chống đẩy dưới sàn phẳng có thể gây viêm gân.',
        recommendation:
          'Khuyến nghị: Sử dụng thanh chống đẩy (Push-up bars) hoặc nắm tay đấm (Knuckle push-up) để giữ cổ tay luôn thẳng trục.',
        icon: AlertTriangle,
      });
    } else if (nameLower.includes('lưng') || nameLower.includes('back')) {
      alerts.push({
        type: 'warning',
        title: `Phát hiện đau lưng / cột sống: ${inj.name}`,
        description: 'Vùng thắt lưng cần được bảo vệ, tránh các chuyển động võng lưng quá mức.',
        recommendation:
          'Khuyến nghị: Khi tập Plank hoặc Squat, hãy siết chặt cơ bụng (Bracing) và không tập đến ngưỡng kiệt sức gây mất form.',
        icon: AlertTriangle,
      });
    } else {
      alerts.push({
        type: 'caution',
        title: `Lưu ý chấn thương: ${inj.name}`,
        description: 'Có chấn thương đang trong quá trình theo dõi.',
        recommendation: 'Khởi động kỹ trước buổi tập và dừng lại ngay nếu xuất hiện cơn đau nhói.',
        icon: AlertTriangle,
      });
    }
  });

  // 2. Kiểm tra giấc ngủ & Mức năng lượng
  if (todayCheckin) {
    const sleepMin = todayCheckin.sleep_duration_minutes || 0;
    if (sleepMin > 0 && sleepMin < 360) {
      // Dưới 6 tiếng
      alerts.push({
        type: 'caution',
        title: 'Thiếu ngủ phục hồi (< 6 tiếng)',
        description: `Ghi nhận thời gian ngủ chỉ ${(sleepMin / 60).toFixed(1)} tiếng. Tốc độ phản xạ và độ ổn định cơ bắp giảm đáng kể.`,
        recommendation:
          'Khuyến nghị: Giảm 20–30% khối lượng tập hôm nay. Tập trung vào các set nhẹ hoặc bài giãn cơ (Mobility), tránh thử thách mức tạ/kỹ năng tối đa.',
        icon: Zap,
      });
    }

    if (todayCheckin.stress_level && todayCheckin.stress_level >= 4) {
      alerts.push({
        type: 'info',
        title: 'Mức căng thẳng thần kinh cao (Stress 4-5/5)',
        description: 'Hệ thần kinh giao cảm đang chịu tải cao từ công việc hoặc đời sống.',
        recommendation:
          'Khuyến nghị: Chọn các bài tập cardio nhẹ nhàng (đi bộ 20p) hoặc hít thở sâu để giảm cortisol, không nên dồn ép bằng các bài HIIT quá nặng.',
        icon: Activity,
      });
    }
  }

  // 3. Kiểm tra huyết áp
  if (latestBP) {
    if (latestBP.systolic >= 140 || latestBP.diastolic >= 90) {
      alerts.push({
        type: 'warning',
        title: `Chỉ số huyết áp cao gần nhất (${latestBP.systolic}/${latestBP.diastolic} mmHg)`,
        description: 'Áp lực lòng mạch tăng cao trong lúc gồng cơ tĩnh quá mức.',
        recommendation:
          'Khuyến nghị: Tuyệt đối không nín thở gồng mình (Valsalva maneuver) khi giữ tư thế tĩnh (Plank/Dead hang). Duy trì nhịp thở đều đặn và tham vấn ý kiến chuyên gia y tế.',
        icon: HeartPulse,
      });
    }
  }

  const hasAlerts = alerts.length > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
              hasAlerts
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {hasAlerts ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>AI Synergy Guard: An Toàn Vận Động</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                AI Đối Chiếu
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Kết nối hồ sơ sức khỏe, chấn thương & sinh hoạt với bài tập
            </p>
          </div>
        </div>
      </div>

      {!hasAlerts ? (
        <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="font-bold">Cơ thể ở trạng thái sẵn sàng rèn luyện cao (Green Light) 🟢</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Không phát hiện chấn thương cấp tính hoặc cảnh báo huyết áp. Giấc ngủ và sinh hoạt ở mức ổn định để hoàn thành các bài tập theo giáo án.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((alert, index) => {
            const Icon = alert.icon;
            const isWarn = alert.type === 'warning';
            return (
              <div
                key={index}
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  isWarn
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Icon className={`w-4 h-4 shrink-0 ${isWarn ? 'text-rose-600' : 'text-amber-600'}`} />
                  <span>{alert.title}</span>
                </div>
                <p className="text-[11px] opacity-90 pl-6 leading-relaxed">
                  {alert.description}
                </p>
                <div className="pl-6 pt-1 text-[11px] font-semibold border-t border-black/5 dark:border-white/5">
                  👉 {alert.recommendation}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400 italic text-center">
        * Lưu ý: Khuyến nghị do thuật toán quy tắc đối chiếu hỗ trợ an toàn vận động; không thay thế chẩn đoán y khoa chuyên sâu.
      </p>
    </div>
  );
}
