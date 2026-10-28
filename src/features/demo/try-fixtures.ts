/**
 * CALISCOACHING - TRY MODE FIXTURES (P1)
 * Dữ liệu hư cấu đóng gói cách ly 100% cho chế độ trải nghiệm tương tác `/try`.
 * TUYỆT ĐỐI KHÔNG gọi mutation DB thật, không seed dữ liệu và không ghi đè tài khoản thật.
 */

export interface MockActivity {
  id: string;
  type: string;
  durationMinutes: number;
  timeLabel: string;
  notes?: string;
}

export interface MockCheckin {
  sleepHours: number;
  quality: number;
  energy: number;
  stress: number;
}

export const MOCK_TRY_DATA = {
  sampleSentences: [
    'Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi',
    'Sáng nay chống đẩy 30 phút, mệt 7, nặng 68kg',
    'Chiều nay hít xà 20 phút, rpe 8',
  ],

  defaultParseResults: {
    'Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi': {
      activities: [
        {
          id: 'mock_act_1',
          type: 'Chạy bộ',
          durationMinutes: 25,
          timeLabel: 'Hôm nay',
          notes: 'Ghi nhận tự nhiên',
        },
      ],
      sleep: {
        sleepHours: 6.5,
        quality: 4,
        energy: 4,
        stress: 2,
      },
      observations: [
        {
          metric: 'Cân nặng',
          value: 68.5,
          unit: 'kg',
        },
      ],
    },
  },

  workoutDemo: {
    routineTitle: 'Calisthenics Khởi Động & Sức Bền',
    totalSets: 3,
    currentSet: 1,
    exercises: [
      { name: 'Hít đất (Push-up)', targetReps: 15, defaultActual: 15 },
      { name: 'Kéo xà (Pull-up)', targetReps: 8, defaultActual: 8 },
      { name: 'Gập bụng (Plank)', targetDurationSec: 45, defaultActual: 45 },
    ],
  },

  skillsDemo: [
    {
      skillName: 'Hít xà đơn (Pull-up)',
      level: 'Cơ bản (Cấp 2/5)',
      lastAttempt: '10 lần chuẩn form · 3 ngày trước',
      status: 'Đang rèn luyện',
    },
    {
      skillName: 'Chống đẩy xà kép (Dips)',
      level: 'Nhập môn (Cấp 1/5)',
      lastAttempt: '12 lần · 5 ngày trước',
      status: 'Đang rèn luyện',
    },
    {
      skillName: 'Lên xà chuẩn (Muscle-up)',
      level: 'Mục tiêu sắp tới',
      lastAttempt: 'Chưa ghi nhận lần thử',
      status: 'Chưa mở khóa',
    },
  ],

  briefSummaryDemo: {
    title: 'Bản tóm tắt quá trình rèn luyện 14 ngày',
    period: '14 ngày qua',
    sessionCount: 6,
    totalMinutes: 195,
    averageSleepHours: 7.2,
    disclaimer: 'Dữ liệu minh họa trong chế độ dùng thử. Không liên kết với bất kỳ hồ sơ y tế hay tài khoản nào.',
    highlights: [
      'Duy trì đều đặn 3 buổi tập calisthenics mỗi tuần.',
      'Thời lượng ngủ trung bình ổn định trên 7 giờ mỗi đêm.',
      'Hoàn thành mốc 10 cái hít xà đơn đúng kỹ thuật.',
    ],
  },
};

export const TRY_FIXTURES = MOCK_TRY_DATA;

