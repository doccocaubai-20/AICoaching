const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const getEnv = (k) => {
  const m = envContent.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '7752c99f-fbc1-4131-9ab6-8c4405dc5af4'; // huyle207200@gmail.com

console.log('Seeding 4-week complete data for user:', userId, '(huyle207200@gmail.com)');

async function runSeed() {
  // 1. Update Profile
  console.log('1. Updating profile...');
  const { error: profileErr } = await supabase.from('profiles').upsert({
    user_id: userId,
    display_name: 'doccocaubai1',
    experience_level: 'intermediate',
    schedule_availability: [
      { day: 'monday', time: 'morning' },
      { day: 'wednesday', time: 'evening' },
      { day: 'friday', time: 'evening' },
      { day: 'sunday', time: 'morning' }
    ],
    available_equipment: ['xà đơn', 'xà kép', 'dây kháng lực', 'sàn nhà'],
    updated_at: new Date().toISOString(),
  });
  if (profileErr) console.error('Profile error:', profileErr);

  // 2. Health Profile
  console.log('2. Updating health profile...');
  const { error: hpErr } = await supabase.from('health_profiles').upsert({
    user_id: userId,
    birth_year: 1998,
    work_context: 'sedentary',
    timezone: 'Asia/Ho_Chi_Minh',
    notes: '[Minh họa demo] Dân văn phòng rèn luyện calisthenics tăng cường sức mạnh và vóc dáng.',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (hpErr) console.error('Health profile error:', hpErr);

  // 3. Clear existing user data in other tables to ensure clean 4-week seeding
  console.log('3. Cleaning existing logs for clean 4-week dataset...');
  await Promise.all([
    supabase.from('goals').delete().eq('user_id', userId),
    supabase.from('activities').delete().eq('user_id', userId),
    supabase.from('observations').delete().eq('user_id', userId),
    supabase.from('daily_checkins').delete().eq('user_id', userId),
    supabase.from('blood_pressure_readings').delete().eq('user_id', userId),
    supabase.from('health_conditions').delete().eq('user_id', userId),
    supabase.from('allergies').delete().eq('user_id', userId),
    supabase.from('medications').delete().eq('user_id', userId),
    supabase.from('health_documents').delete().eq('user_id', userId),
    supabase.from('health_events').delete().eq('user_id', userId),
    supabase.from('session_results').delete().eq('user_id', userId),
    supabase.from('ai_consents').delete().eq('user_id', userId),
    supabase.from('ai_summaries').delete().eq('user_id', userId),
  ]);

  // 4. Goals
  console.log('4. Seeding goals...');
  const { error: goalsErr } = await supabase.from('goals').insert([
    {
      user_id: userId,
      content: 'Hít xà đơn 10 cái chuẩn form (Demo)',
      goal_type: 'strength',
      status: 'active',
      start_date: '2026-10-01',
      end_date: '2026-11-30',
    },
    {
      user_id: userId,
      content: 'Chống đẩy 25 cái liên tục chuẩn form (Demo)',
      goal_type: 'strength',
      status: 'active',
      start_date: '2026-10-01',
      end_date: '2026-11-30',
    },
    {
      user_id: userId,
      content: 'Duy trì tập luyện calisthenics 3-4 buổi/tuần (Demo)',
      goal_type: 'habit',
      status: 'active',
      start_date: '2026-10-01',
      end_date: '2026-11-30',
    },
  ]);
  if (goalsErr) console.error('Goals error:', goalsErr);

  // 5. Daily Check-ins (28 full days: 2026-10-01 to 2026-10-28)
  console.log('5. Seeding 28 days of daily check-ins...');
  const dailyCheckins = [];
  const notesPool = [
    'Ngủ sâu giấc, tỉnh dậy sảng khoái và tràn đầy năng lượng.',
    'Hơi mỏi nhẹ cơ ngực sau buổi tập calisthenics hôm qua.',
    'Ngày nghỉ ngơi hồi phục, đi dạo nhẹ nhàng.',
    'Uống đủ 2.5 lít nước, tập luyện rất sung sức.',
    'Cơ bắp thích nghi tốt, kéo xà cảm giác nhẹ hơn.',
    'Công việc bận rộn nhưng vẫn duy trì giấc ngủ tốt.',
    'Cuối tuần thư giãn, ngủ bù thoải mái.'
  ];

  for (let day = 1; day <= 28; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const localDate = `2026-10-${dayStr}`;
    const dayOfWeek = (day + 3) % 7; // 1 = Thurs, 2 = Fri, 3 = Sat, 4 = Sun...
    const isWeekend = dayOfWeek === 3 || dayOfWeek === 4;

    let sleepDuration = 450; // 7.5h
    let sleepQuality = 4;
    let energyLevel = 4;
    let stressLevel = 2;

    if (isWeekend) {
      sleepDuration = 480 + (day % 3) * 15; // 8h - 8.5h
      sleepQuality = 5;
      energyLevel = 5;
      stressLevel = 1;
    } else if (day === 12 || day === 20) {
      // Busy workday
      sleepDuration = 390; // 6.5h
      sleepQuality = 3;
      energyLevel = 3;
      stressLevel = 3;
    } else {
      sleepDuration = 420 + (day % 4) * 15; // 7h - 7.75h
      sleepQuality = 4;
      energyLevel = 4;
      stressLevel = 2;
    }

    dailyCheckins.push({
      user_id: userId,
      local_date: localDate,
      sleep_duration_minutes: sleepDuration,
      sleep_quality: sleepQuality,
      energy_level: energyLevel,
      stress_level: stressLevel,
      notes: notesPool[day % notesPool.length],
    });
  }

  const { error: checkinErr } = await supabase.from('daily_checkins').insert(dailyCheckins);
  if (checkinErr) console.error('Checkin error:', checkinErr);
  else console.log(`✓ Inserted ${dailyCheckins.length} daily check-ins`);

  // 6. Activities (16 workouts across 4 weeks + 1 future planned)
  console.log('6. Seeding activities across 4 weeks...');
  const activities = [
    // --- TUẦN 1 (01/10 - 07/10) ---
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-01T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Khởi động tuần 1: Kéo xà trợ lực dây kháng lực 4x6, Chống đẩy chuẩn 4x10, Dead hang 3x30s.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261001-calis',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-03T10:00:00+07:00',
      duration_minutes: 50,
      fatigue_level: 7,
      notes: '[Minh họa demo] Thân dưới & Core: Bodyweight squat 4x15, Walking lunges 3x10 mỗi chân, Plank 3x40s.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261003-calis',
    },
    {
      user_id: userId,
      activity_type: 'running',
      is_planned: false,
      start_at: '2026-10-04T16:30:00+07:00',
      duration_minutes: 30,
      fatigue_level: 5,
      notes: '[Minh họa demo] Chạy bộ nhẹ nhàng nhịp tim vùng 2 tại công viên, quãng đường 3.8 km.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261004-run',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-06T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Thân trên: Dips xà kép có trợ lực 3x8, Chống đẩy kim cương 3x8, Hollow body hold 3x25s.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261006-calis',
    },

    // --- TUẦN 2 (08/10 - 14/10) ---
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-08T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Tuần 2: Hít xà đơn chuẩn 4x4, Chống đẩy dốc chân 4x10, Australian pull-up 3x10.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261008-calis',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-10T10:00:00+07:00',
      duration_minutes: 50,
      fatigue_level: 7,
      notes: '[Minh họa demo] Chân & Bụng: Jump squat 3x10, Bulgary split squat 3x8 mỗi chân, Hanging knee raise 3x10.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261010-calis',
    },
    {
      user_id: userId,
      activity_type: 'badminton',
      is_planned: false,
      start_at: '2026-10-11T16:00:00+07:00',
      duration_minutes: 60,
      fatigue_level: 6,
      notes: '[Minh họa demo] Giao lưu cầu lông đôi nam phong trào cuối tuần, vận động linh hoạt.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261011-badm',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-13T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Thân trên & Kỹ năng: Handstand kick-up vào tường 5 lần, Pike push-up 3x8, Chống đẩy 3x12.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261013-calis',
    },

    // --- TUẦN 3 (15/10 - 21/10) ---
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-15T10:00:00+07:00',
      duration_minutes: 40,
      fatigue_level: 6,
      notes: '[Minh họa demo] Kéo xà trợ lực dây kháng lực và chống đẩy khuỷu tay 45 độ.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261015-calis',
    },
    {
      user_id: userId,
      activity_type: 'running',
      is_planned: false,
      start_at: '2026-10-17T10:00:00+07:00',
      duration_minutes: 25,
      fatigue_level: 5,
      notes: '[Minh họa demo] Chạy bộ nhẹ nhàng khởi động tại công viên.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261017-run',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-19T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 7,
      notes: '[Minh họa demo] Buổi tập thân trên: 4 hiệp hít xà trợ lực, 4 hiệp chống đẩy, 3 hiệp dead hang.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261019-calis',
    },
    {
      user_id: userId,
      activity_type: 'walking',
      is_planned: false,
      start_at: '2026-10-21T11:00:00+07:00',
      duration_minutes: 30,
      fatigue_level: 4,
      notes: '[Minh họa demo] Đi bộ thả lỏng buổi tối thư giãn cơ bắp.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261021-walk',
    },

    // --- TUẦN 4 (22/10 - 28/10) ---
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-23T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Chống đẩy cơ bản 3x10, squat thể trọng 3x12, plank 3x35 giây.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261023-calis',
    },
    {
      user_id: userId,
      activity_type: 'badminton',
      is_planned: false,
      start_at: '2026-10-24T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: 6,
      notes: '[Minh họa demo] Đánh cầu lông giao lưu phong trào với bạn bè.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261024-badm',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-26T10:00:00+07:00',
      duration_minutes: 40,
      fatigue_level: 6,
      notes: '[Minh họa demo] Thân trên: Kéo xà 3 hiệp x 4 lần, chống đẩy 3 hiệp x 10 lần, giữ dead hang 30 giây.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261026-calis',
    },
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: false,
      start_at: '2026-10-28T09:30:00+07:00',
      duration_minutes: 50,
      fatigue_level: 7,
      notes: '[Minh họa demo] Buổi tập hôm nay: Kéo xà 4x5 cái (chuẩn form không đung đưa), Dips xà kép 4x8, Hanging L-sit hold 3x15s.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261028-calis',
    },

    // --- KẾ HOẠCH DỰ KIẾN TƯƠNG LAI ---
    {
      user_id: userId,
      activity_type: 'calisthenics',
      is_planned: true,
      start_at: '2026-10-30T10:00:00+07:00',
      duration_minutes: 45,
      fatigue_level: null,
      notes: '[Lịch dự kiến] Buổi tập thân dưới & Core cuối tuần: Squat, Lunges, Plank.',
      source: 'manual_entry',
      idempotency_key: 'seed-act-20261030-plan',
    }
  ];

  const { error: actErr } = await supabase.from('activities').insert(activities);
  if (actErr) console.error('Activities error:', actErr);
  else console.log(`✓ Inserted ${activities.length} activities`);

  // 7. Session Results (Calisthenics logs)
  console.log('7. Seeding session results...');
  const sessionResults = [
    {
      session_id: 'b0000000-0000-0000-0000-000000000001',
      user_id: userId,
      completed_at: '2026-10-01T11:00:00+07:00',
      self_reported_data: {
        rpe: 6,
        completed_reps: 24,
        exercises: [
          { exercise_name: 'Hút xà đơn trợ lực', actual_sets: 3, actual_reps: '6' },
          { exercise_name: 'Chống đẩy tiêu chuẩn', actual_sets: 3, actual_reps: '10' },
          { exercise_name: 'Dead hang', actual_sets: 3, actual_reps: '30s' }
        ]
      },
      notes: '[Minh họa demo] Hoàn thành buổi 1 tuần đầu, cơ tay sau hơi mỏi.',
      idempotency_key: 'seed-sr-20261001',
      is_demo: true,
    },
    {
      session_id: 'b0000000-0000-0000-0000-000000000002',
      user_id: userId,
      completed_at: '2026-10-03T11:00:00+07:00',
      self_reported_data: {
        rpe: 7,
        completed_reps: 35,
        exercises: [
          { exercise_name: 'Bodyweight squat', actual_sets: 3, actual_reps: '15' },
          { exercise_name: 'Plank', actual_sets: 3, actual_reps: '40s' },
          { exercise_name: 'Walking lunges', actual_sets: 3, actual_reps: '10 mỗi chân' }
        ]
      },
      notes: '[Minh họa demo] Hoàn thành buổi 2: Chân & Cơ bụng.',
      idempotency_key: 'seed-sr-20261003',
      is_demo: true,
    },
    {
      session_id: 'b0000000-0000-0000-0000-000000000001',
      user_id: userId,
      completed_at: '2026-10-08T11:00:00+07:00',
      self_reported_data: {
        rpe: 6,
        completed_reps: 28,
        exercises: [
          { exercise_name: 'Hít xà đơn chuẩn', actual_sets: 4, actual_reps: '4' },
          { exercise_name: 'Chống đẩy tiêu chuẩn', actual_sets: 4, actual_reps: '12' },
          { exercise_name: 'Dead hang', actual_sets: 3, actual_reps: '35s' }
        ]
      },
      notes: '[Minh họa demo] Kéo xà chuẩn form bắt đầu tiến bộ.',
      idempotency_key: 'seed-sr-20261008',
      is_demo: true,
    },
    {
      session_id: 'b0000000-0000-0000-0000-000000000001',
      user_id: userId,
      completed_at: '2026-10-23T11:00:00+07:00',
      self_reported_data: {
        rpe: 7,
        completed_reps: 28,
        exercises: [
          { exercise_name: 'Hít xà đơn có trợ lực', actual_sets: 3, actual_reps: '6' },
          { exercise_name: 'Chống đẩy tiêu chuẩn', actual_sets: 3, actual_reps: '12' },
          { exercise_name: 'Dead hang', actual_sets: 3, actual_reps: '35s' }
        ]
      },
      notes: '[Minh họa demo] Hoàn thành buổi tập: Buổi 1: Thân trên - Kéo & Đẩy cơ bản (Demo)',
      idempotency_key: 'seed-sr-20261023',
      is_demo: true,
    },
    {
      session_id: 'b0000000-0000-0000-0000-000000000002',
      user_id: userId,
      completed_at: '2026-10-26T11:00:00+07:00',
      self_reported_data: {
        rpe: 7,
        completed_reps: 36,
        exercises: [
          { exercise_name: 'Squat thể trọng', actual_sets: 3, actual_reps: '15' },
          { exercise_name: 'Plank giữ thân thẳng', actual_sets: 3, actual_reps: '40s' },
          { exercise_name: 'Chùng chân luân phiên', actual_sets: 3, actual_reps: '10' }
        ]
      },
      notes: '[Minh họa demo] Hoàn thành buổi tập: Buổi 2: Chân & Cơ bụng (Demo)',
      idempotency_key: 'seed-sr-20261026',
      is_demo: true,
    },
    {
      session_id: 'b0000000-0000-0000-0000-000000000001',
      user_id: userId,
      completed_at: '2026-10-28T10:30:00+07:00',
      self_reported_data: {
        rpe: 7,
        completed_reps: 32,
        exercises: [
          { exercise_name: 'Hít xà đơn chuẩn', actual_sets: 4, actual_reps: '5' },
          { exercise_name: 'Chống đẩy tiêu chuẩn', actual_sets: 4, actual_reps: '15' },
          { exercise_name: 'Dead hang', actual_sets: 3, actual_reps: '40s' }
        ]
      },
      notes: '[Minh họa demo] Kỷ lục cá nhân mới: Hít xà 5 reps chuẩn form x 4 hiệp!',
      idempotency_key: 'seed-sr-20261028',
      is_demo: true,
    }
  ];

  const { error: srErr } = await supabase.from('session_results').insert(sessionResults);
  if (srErr) console.error('Session results error:', srErr);
  else console.log(`✓ Inserted ${sessionResults.length} session results`);

  // 8. Observations (Biometrics over 4 weeks)
  console.log('8. Seeding observations (height, weight, resting heart rate, waist, body feel)...');
  const observations = [
    // Chiều cao
    {
      user_id: userId,
      metric_type: 'height',
      metric_value: 172,
      metric_unit: 'cm',
      observed_at: '2026-10-01T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Chiều cao chuẩn đo buổi sáng.',
    },
    // Cân nặng theo tuần (tiến trình giảm mỡ tăng cơ lành mạnh: 69.0 -> 67.3 kg)
    {
      user_id: userId,
      metric_type: 'weight',
      metric_value: 69.0,
      metric_unit: 'kg',
      observed_at: '2026-10-01T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cân nặng đầu tháng 10.',
    },
    {
      user_id: userId,
      metric_type: 'weight',
      metric_value: 68.6,
      metric_unit: 'kg',
      observed_at: '2026-10-08T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cân nặng tuần 2.',
    },
    {
      user_id: userId,
      metric_type: 'weight',
      metric_value: 68.1,
      metric_unit: 'kg',
      observed_at: '2026-10-15T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cân nặng tuần 3.',
    },
    {
      user_id: userId,
      metric_type: 'weight',
      metric_value: 67.7,
      metric_unit: 'kg',
      observed_at: '2026-10-22T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cân nặng tuần 4.',
    },
    {
      user_id: userId,
      metric_type: 'weight',
      metric_value: 67.3,
      metric_unit: 'kg',
      observed_at: '2026-10-28T07:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cân nặng hôm nay sau 4 tuần calisthenics kiên trì (-1.7kg mỡ, săn chắc).',
    },
    // Nhịp tim nghỉ (cải thiện rõ rệt: 66 -> 59 bpm)
    {
      user_id: userId,
      metric_type: 'resting_heart_rate',
      metric_value: 66,
      metric_unit: 'bpm',
      observed_at: '2026-10-01T07:15:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Nhịp tim nghỉ đo lúc thức dậy.',
    },
    {
      user_id: userId,
      metric_type: 'resting_heart_rate',
      metric_value: 64,
      metric_unit: 'bpm',
      observed_at: '2026-10-10T07:15:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Nhịp tim nghỉ tuần 2.',
    },
    {
      user_id: userId,
      metric_type: 'resting_heart_rate',
      metric_value: 61,
      metric_unit: 'bpm',
      observed_at: '2026-10-20T07:15:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Nhịp tim nghỉ tuần 3.',
    },
    {
      user_id: userId,
      metric_type: 'resting_heart_rate',
      metric_value: 59,
      metric_unit: 'bpm',
      observed_at: '2026-10-28T07:15:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Nhịp tim nghỉ hôm nay, thể lực tim mạch cải thiện xuất sắc.',
    },
    // Vòng eo (80.5 -> 77.5 cm)
    {
      user_id: userId,
      metric_type: 'waist_circumference',
      metric_value: 80.5,
      metric_unit: 'cm',
      observed_at: '2026-10-01T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Vòng eo ngang rốn đầu tháng 10.',
    },
    {
      user_id: userId,
      metric_type: 'waist_circumference',
      metric_value: 79.0,
      metric_unit: 'cm',
      observed_at: '2026-10-15T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Vòng eo giữa tháng 10.',
    },
    {
      user_id: userId,
      metric_type: 'waist_circumference',
      metric_value: 77.5,
      metric_unit: 'cm',
      observed_at: '2026-10-28T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Vòng eo hôm nay, bụng phẳng và múi cơ lộ rõ.',
    },
    // Cảm nhận cơ thể (body_feel)
    {
      user_id: userId,
      metric_type: 'body_feel',
      metric_value: 7,
      metric_unit: 'scale_1_10',
      observed_at: '2026-10-01T20:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Khởi đầu lộ trình mới đầy hứng khởi.',
    },
    {
      user_id: userId,
      metric_type: 'body_feel',
      metric_value: 8,
      metric_unit: 'scale_1_10',
      observed_at: '2026-10-15T20:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Cơ thể thích nghi tốt, đỡ đau mỏi sau tập.',
    },
    {
      user_id: userId,
      metric_type: 'body_feel',
      metric_value: 9,
      metric_unit: 'scale_1_10',
      observed_at: '2026-10-28T20:00:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Thể lực sung mãn, cơ thể săn chắc nhẹ nhõm.',
    }
  ];

  const { error: obsErr } = await supabase.from('observations').insert(observations);
  if (obsErr) console.error('Observations error:', obsErr);
  else console.log(`✓ Inserted ${observations.length} observations`);

  // 9. Blood Pressure Readings (4 weekly readings)
  console.log('9. Seeding blood pressure readings...');
  const bloodPressures = [
    {
      user_id: userId,
      systolic: 124,
      diastolic: 82,
      measured_at: '2026-10-02T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Huyết áp tuần 1, đo lúc nghỉ ngơi buổi sáng.',
    },
    {
      user_id: userId,
      systolic: 122,
      diastolic: 80,
      measured_at: '2026-10-09T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Huyết áp tuần 2, chỉ số lý tưởng.',
    },
    {
      user_id: userId,
      systolic: 120,
      diastolic: 78,
      measured_at: '2026-10-16T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Huyết áp tuần 3, tim mạch ổn định.',
    },
    {
      user_id: userId,
      systolic: 118,
      diastolic: 76,
      measured_at: '2026-10-25T07:30:00+07:00',
      source: 'self_reported',
      notes: '[Minh họa demo] Huyết áp tuần 4, chỉ số sức khỏe tối ưu.',
    }
  ];

  const { error: bpErr } = await supabase.from('blood_pressure_readings').insert(bloodPressures);
  if (bpErr) console.error('Blood pressure error:', bpErr);
  else console.log(`✓ Inserted ${bloodPressures.length} blood pressure readings`);

  // 10. Health Conditions & Injuries
  console.log('10. Seeding health conditions & injuries...');
  const conditions = [
    {
      user_id: userId,
      name: 'Mỏi khớp cổ tay khi chống đẩy',
      category: 'injury',
      started_at: '2026-09-15',
      status: 'resolved',
      notes: '[Minh họa demo] Đã đổi tư thế đặt tay chuẩn và dùng tay nắm hít đất hoặc xà kép, cổ tay hoàn toàn bình thường.',
    },
    {
      user_id: userId,
      name: 'Căng cơ bắp chuối sau chạy bộ',
      category: 'self_reported_symptom',
      started_at: '2026-10-04',
      status: 'resolved',
      notes: '[Minh họa demo] Giãn cơ kỹ sau chạy và ngâm chân nước ấm 2 ngày là khỏi hẳn.',
    }
  ];

  const { error: condErr } = await supabase.from('health_conditions').insert(conditions);
  if (condErr) console.error('Health conditions error:', condErr);
  else console.log(`✓ Inserted ${conditions.length} health conditions`);

  // 11. Allergies
  console.log('11. Seeding allergies...');
  const allergies = [
    {
      user_id: userId,
      allergen: 'Bụi mịn & không khí lạnh giao mùa',
      reaction: 'Hắt hơi, nghẹt mũi nhẹ lúc sáng sớm',
      severity: 'mild',
      status: 'known',
      notes: '[Minh họa demo] Đeo khẩu trang khi chạy bộ ngoài trời và giữ ấm cổ.',
    }
  ];

  const { error: algErr } = await supabase.from('allergies').insert(allergies);
  if (algErr) console.error('Allergies error:', algErr);
  else console.log(`✓ Inserted ${allergies.length} allergies`);

  // 12. Medications
  console.log('12. Seeding medications...');
  const medications = [
    {
      user_id: userId,
      name: 'Dầu cá Omega-3 & Vitamin D3',
      dosage_instructions: '1 viên mỗi ngày sau bữa ăn sáng',
      started_at: '2026-10-01',
      status: 'active',
      notes: '[Minh họa demo] Bổ sung vi chất hỗ trợ phục hồi cơ khớp và tim mạch.',
    }
  ];

  const { error: medErr } = await supabase.from('medications').insert(medications);
  if (medErr) console.error('Medications error:', medErr);
  else console.log(`✓ Inserted ${medications.length} medications`);

  // 13. Health Events & Documents
  console.log('13. Seeding health events & documents...');
  const { data: eventData, error: evErr } = await supabase.from('health_events').insert([
    {
      user_id: userId,
      event_type: 'checkup',
      event_date: '2026-10-10',
      facility_name: 'Phòng khám Đa khoa Quốc tế',
      notes: '[Minh họa demo] Khám sức khỏe thể thao định kỳ 6 tháng một lần.',
    }
  ]).select();

  if (evErr) {
    console.error('Health event error:', evErr);
  } else if (eventData && eventData[0]) {
    const eventId = eventData[0].id;
    const { error: docErr } = await supabase.from('health_documents').insert([
      {
        user_id: userId,
        event_id: eventId,
        title: 'Phiếu kết quả khám sức khỏe tổng quát',
        file_name: 'ket_qua_kham_dinh_ky_10_2026.pdf',
        file_type: 'application/pdf',
        file_size_bytes: 245760,
        storage_path: `${userId}/ket_qua_kham_dinh_ky_10_2026.pdf`,
        notes: '[Minh họa demo] Các chỉ số tim mạch, chức năng gan thận đều bình thường.',
      }
    ]);
    if (docErr) console.error('Health document error:', docErr);
    else console.log('✓ Inserted 1 health document linked to event');
  }

  // 14. AI Consents
  console.log('14. Seeding AI consents (all 6 scopes enabled)...');
  const { error: consentErr } = await supabase.from('ai_consents').insert([
    {
      user_id: userId,
      consent_version: 'v1.0-mvp',
      scope: ['profile', 'goals', 'activities', 'observations', 'daily_checkins', 'blood_pressures'],
      is_granted: true,
      granted_at: new Date().toISOString(),
    }
  ]);
  if (consentErr) console.error('Consent error:', consentErr);
  else console.log('✓ Inserted AI consents with all 6 scopes');

  // 15. AI Summaries (7-day summary + 4-week trend analysis)
  console.log('15. Seeding AI summaries and 4-week trend analysis...');
  const aiSummaries = [
    {
      user_id: userId,
      input_scope: { start_date: '21/10/2026', end_date: '28/10/2026' },
      status: 'ai_generated',
      content: 'Trong 7 ngày qua (21/10 - 28/10/2026), bạn đã duy trì thói quen tập luyện xuất sắc với 4 buổi vận động: đi bộ thả lỏng (21/10), 3 buổi calisthenics (23/10, 26/10 và 28/10) và 1 buổi cầu lông (24/10). Đáng chú ý, bạn đã thiết lập kỷ lục mới với 5 lần hít xà chuẩn form mỗi hiệp vào ngày 28/10. Cân nặng giảm đều xuống 67.3 kg, huyết áp duy trì ở mức lý tưởng 118/76 mmHg và thời lượng ngủ trung bình đạt 7.6 giờ/ngày.',
      missing_data_notes: null,
      reference_record_ids: [
        'seed-act-20261021-walk',
        'seed-act-20261023-calis',
        'seed-act-20261024-badm',
        'seed-act-20261026-calis',
        'seed-act-20261028-calis'
      ],
      is_demo: false,
    },
    {
      user_id: userId,
      input_scope: {
        kind: 'analysis',
        weeks: 4,
        metrics: {
          period: {
            from: '01/10/2026',
            to: '28/10/2026',
            weeks: 4
          },
          total_completed_sessions: 16,
          total_duration_minutes: 720,
          weekly_frequency: [
            {
              week_number: 1,
              label: 'Tuần 1 (01/10 - 07/10)',
              from_date: '01/10/2026',
              to_date: '07/10/2026',
              session_count: 4,
              has_records: true,
              activity_ids: ['seed-act-20261001-calis', 'seed-act-20261003-calis', 'seed-act-20261004-run', 'seed-act-20261006-calis']
            },
            {
              week_number: 2,
              label: 'Tuần 2 (08/10 - 14/10)',
              from_date: '08/10/2026',
              to_date: '14/10/2026',
              session_count: 4,
              has_records: true,
              activity_ids: ['seed-act-20261008-calis', 'seed-act-20261010-calis', 'seed-act-20261011-badm', 'seed-act-20261013-calis']
            },
            {
              week_number: 3,
              label: 'Tuần 3 (15/10 - 21/10)',
              from_date: '15/10/2026',
              to_date: '21/10/2026',
              session_count: 4,
              has_records: true,
              activity_ids: ['seed-act-20261015-calis', 'seed-act-20261017-run', 'seed-act-20261019-calis', 'seed-act-20261021-walk']
            },
            {
              week_number: 4,
              label: 'Tuần 4 (22/10 - 28/10)',
              from_date: '22/10/2026',
              to_date: '28/10/2026',
              session_count: 4,
              has_records: true,
              activity_ids: ['seed-act-20261023-calis', 'seed-act-20261024-badm', 'seed-act-20261026-calis', 'seed-act-20261028-calis']
            }
          ],
          plan_vs_actual: {
            planned_count: 1,
            actual_count: 16,
            activity_ids: []
          },
          sport_distribution: [
            {
              sport: 'calisthenics',
              label: 'Calisthenics',
              minutes: 495,
              percentage: 69,
              session_count: 11,
              activity_ids: []
            },
            {
              sport: 'badminton',
              label: 'Cầu lông',
              minutes: 105,
              percentage: 15,
              session_count: 2,
              activity_ids: []
            },
            {
              sport: 'running',
              label: 'Chạy bộ',
              minutes: 55,
              percentage: 8,
              session_count: 2,
              activity_ids: []
            },
            {
              sport: 'walking',
              label: 'Đi bộ',
              minutes: 30,
              percentage: 4,
              session_count: 1,
              activity_ids: []
            }
          ],
          fatigue_trends: [
            {
              sport: 'calisthenics',
              label: 'Calisthenics',
              sessions_with_fatigue: 11,
              average_fatigue: 6.2,
              status: 'sufficient_data',
              activity_ids: []
            }
          ],
          schedule_alignment: {
            status: 'sufficient_data',
            matching_sessions_count: 14,
            total_completed_sessions: 16,
            match_percentage: 88,
            activity_ids: []
          },
          goal_progress: {
            status: 'sufficient_data',
            session_results_count: 6,
            active_goals_count: 3,
            session_result_ids: []
          },
          missing_data_ratios: {
            missing_fatigue_percentage: 0,
            missing_weight_in_period: false,
            unrecorded_weeks_count: 0
          },
          allowed_record_ids: []
        }
      },
      status: 'ai_generated',
      content: JSON.stringify({
        highlights: [
          {
            metric_key: 'total_completed_sessions',
            text: 'Bạn đã hoàn thành xuất sắc 16 buổi tập luyện liên tục trong 4 tuần (đạt 100% mục tiêu 3-4 buổi/tuần).',
            references: [
              { type: 'activity', id: 'seed-act-20261001-calis' },
              { type: 'activity', id: 'seed-act-20261008-calis' },
              { type: 'activity', id: 'seed-act-20261015-calis' },
              { type: 'activity', id: 'seed-act-20261028-calis' }
            ]
          },
          {
            metric_key: 'body_composition',
            text: 'Cân nặng giảm ổn định từ 69.0 kg xuống 67.3 kg (-1.7 kg), vòng eo giảm 3.0 cm từ 80.5 cm về 77.5 cm.',
            references: []
          },
          {
            metric_key: 'cardiovascular_fitness',
            text: 'Nhịp tim nghỉ cải thiện ngoạn mục từ 66 bpm xuống 59 bpm, phản ánh sự phát triển tích cực của hệ tim mạch.',
            references: []
          },
          {
            metric_key: 'lifestyle_synergy',
            text: 'Giấc ngủ duy trì trung bình 7.5 giờ mỗi đêm qua 28 ngày check-in liên tiếp, hỗ trợ phục hồi cơ bắp tối ưu.',
            references: []
          }
        ],
        missing_data: [],
        period: {
          from: '01/10/2026',
          to: '28/10/2026',
          weeks: 4
        }
      }),
      missing_data_notes: null,
      reference_record_ids: [
        'seed-act-20261001-calis',
        'seed-act-20261008-calis',
        'seed-act-20261015-calis',
        'seed-act-20261028-calis'
      ],
      is_demo: false,
    }
  ];

  const { error: sumErr } = await supabase.from('ai_summaries').insert(aiSummaries);
  if (sumErr) console.error('AI summaries error:', sumErr);
  else console.log(`✓ Inserted ${aiSummaries.length} AI summaries (7-day summary + 4-week analysis)`);

  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY! ===');
}

runSeed().catch((err) => {
  console.error('Fatal error during seed:', err);
  process.exit(1);
});
