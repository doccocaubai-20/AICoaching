# CONTRACTS — Hợp đồng Dữ liệu & Giao tiếp Liên Agent

Tài liệu khóa các hợp đồng và kiểu dữ liệu chung cho 4 agent song song (A, B, C, D) và Điều phối.

---

## 1. Cấu trúc kết quả chung (`ActionResult<T>`)

```typescript
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
}
```

- Không trả raw SQL error hoặc stack trace ra giao diện người dùng.
- Mã lỗi ổn định: `UNAUTHORIZED`, `FORBIDDEN_OWNERSHIP`, `QUOTA_EXCEEDED`, `NOT_FOUND`, `VALIDATION_ERROR`, `STALE_SOURCE`.

---

## 2. Định danh Nguồn & Bài tập (`SourceRef`, `ExerciseRef`)

### `SourceRef`
```typescript
export interface SourceRef {
  sourceType: 'activity' | 'session_result' | 'workout_session_result';
  sourceId: string; // UUID
  sourceVersionHash?: string;
  recordedAt: string; // ISO 8601 UTC
}
```

### `ExerciseRef`
```typescript
export interface ExerciseRef {
  exerciseId: string; // Định danh bền vững: 'dead_hang', 'inverted_row', 'pull_up', 'push_up', 'dip'
  variantId: string;  // Biến thể: 'standard', 'active_grip', 'slow_eccentric', 'band_assisted'
  assistance: string; // 'bodyweight' | 'resistance_band_15kg' | 'foot_supported' | 'eccentric_only'
  unit?: 'reps' | 'seconds';
}
```

---

## 3. Hợp đồng Xuất khẩu của từng Agent

- **Agent A:**
  - `QuickCaptureLauncher`: Nút hoặc modal ghi nhanh 1 câu.
  - `BriefCreationCTA`: CTA tạo bản tóm tắt hồ sơ đem đi khám/trao đổi.
- **Agent B:**
  - `getWorkoutResumeCard()`: Card hiển thị buổi đang dở / buổi tiếp theo.
  - DTO kết quả buổi tập cho điều phối.
- **Agent C:**
  - `JourneySummaryCard`: Component tóm tắt tiến trình hành trình kỹ năng hiện tại (không tải signed URL hàng loạt).
  - `getJourneySummary(userId: string)`: Server function trả về metadata hành trình cho Dashboard/Programs.
  - `EvidencePicker`: Component duyệt và chọn hoạt động / kết quả hợp lệ để gắn làm bằng chứng.
  - `adaptWorkoutResultToJourneyEvidence(workoutResult)`: Adapter chuyển kết quả Agent B thành chứng cứ cho Agent C.
- **Agent D:**
  - `getGroupWeekSummary()`: Component tóm tắt cam kết nhóm tuần.

---

## 4. Quy ước Video & Lưu trữ (Agent C)

- **Bucket:** `comparison_videos` (Private Bucket, RLS nghiêm ngặt).
- **Giới hạn tệp:** Tối đa `20,971,520` bytes (20 MiB integer bytes) mỗi clip.
- **Hạn mức người dùng:** `104,857,600` bytes (100 MiB) tổng dung lượng video.
- **Thời lượng gợi ý:** 15–30 giây (client-estimated, không tuyên bố server validate duration).
- **Định dạng cho phép:** `video/mp4`, `video/webm`.
- **Signed URL TTL:** 300 giây (5 phút). URL có thể truy cập được đến khi hết TTL.
- **Quyền riêng tư:** Chỉ chủ sở hữu (`user_id = auth.uid()`) được xem. Không tự động chia sẻ cho nhóm D hoặc public snapshot A.
