import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TRY_DATA, TRY_FIXTURES } from '@/features/demo/try-fixtures';

describe('Demo Sandbox Isolation & Integrity (/try)', () => {
  it('cung cấp đầy đủ fixtures mẫu cho 3 bước tương tác', () => {
    expect(MOCK_TRY_DATA.sampleSentences.length).toBeGreaterThan(0);
    const firstSentence = MOCK_TRY_DATA.sampleSentences[0];
    const parsed = MOCK_TRY_DATA.defaultParseResults[firstSentence as keyof typeof MOCK_TRY_DATA.defaultParseResults];
    expect(parsed).toBeDefined();
    expect(parsed.activities.length).toBeGreaterThan(0);
    expect(parsed.activities[0].type).toBe('Chạy bộ');
    expect(parsed.activities[0].durationMinutes).toBe(25);
    expect(parsed.sleep.sleepHours).toBe(6.5);

    // Workout sample
    expect(MOCK_TRY_DATA.workoutDemo.routineTitle).toBeTruthy();
    expect(MOCK_TRY_DATA.workoutDemo.exercises.length).toBeGreaterThan(0);

    // Skills & Brief samples
    expect(MOCK_TRY_DATA.skillsDemo.length).toBeGreaterThan(0);
    expect(MOCK_TRY_DATA.briefSummaryDemo.title).toBeTruthy();
    expect(MOCK_TRY_DATA.briefSummaryDemo.sessionCount).toBe(6);
  });

  it('file try-fixtures.ts không import Supabase hoặc client DB mutation nào', () => {
    const fixtureFilePath = path.join(process.cwd(), 'src', 'features', 'demo', 'try-fixtures.ts');
    const content = fs.readFileSync(fixtureFilePath, 'utf8');

    expect(content).not.toMatch(/@supabase/);
    expect(content).not.toMatch(/createClient/);
    expect(content).not.toMatch(/supabase/i);
    expect(content).not.toMatch(/fetch\(/);
  });

  it('trang /try không import Supabase, mutation Server Actions, hay gọi API mutate DB', () => {
    const tryPagePath = path.join(process.cwd(), 'src', 'app', 'try', 'page.tsx');
    const content = fs.readFileSync(tryPagePath, 'utf8');

    // Không import Supabase
    expect(content).not.toMatch(/@supabase/);
    expect(content).not.toMatch(/createClient/);
    // Không dùng action mutation
    expect(content).not.toMatch(/from ['"]@\/actions/);
    expect(content).not.toMatch(/useServerAction/);
    // Không fetch mutate
    expect(content).not.toMatch(/fetch\(['"`]\/api/);
    expect(content).not.toMatch(/method:\s*['"]POST['"]/i);
    expect(content).not.toMatch(/method:\s*['"]PUT['"]/i);
    expect(content).not.toMatch(/method:\s*['"]DELETE['"]/i);
  });

  it('dữ liệu fixtures hoàn toàn hư cấu, không chứa JWT hoặc secret keys', () => {
    const jsonStr = JSON.stringify(TRY_FIXTURES);
    expect(jsonStr).not.toMatch(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/); // Không có JWT token
    expect(jsonStr).not.toMatch(/sbp_[a-zA-Z0-9]+/); // Không có Supabase Service key
    expect(jsonStr).not.toMatch(/sk-[a-zA-Z0-9]+/); // Không có OpenAI/Anthropic/Gemini key
  });
});
