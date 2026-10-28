# BÁO CÁO BÀN GIAO: AGENT B — D3 TIẾP TỤC TẬP CÓ TRÍ NHỚ
## CALISCOACHING — WORKOUT CONTINUITY WITH MEMORY & PERSISTENCE

> **Người thực hiện:** Agent B  
> **Phạm vi sở hữu:** `src/features/workout/**`, `src/app/workout/**`, `src/contracts/database-b.types.ts`, `supabase/migrations/20261028000011_agent_b_workout_runs.sql`, `src/tests/agent-b-*.test.ts`.  
> **BASE_SHA:** `56d50f21cdb110744f4f65ca920ed64aa0306ba6`  
> **Trạng thái kiểm thử:** 292/292 tests passed across 26 test suites (100% pass trên Vitest + PGlite)

---

## 1. Tổng quan Kiến trúc D3 (Workout Flow with Memory)

Luồng tập luyện trực tiếp có trí nhớ giải quyết triệt để bài toán:
**Bắt đầu ➔ Ghi từng hiệp ➔ Tạm dừng ➔ Tải lại trang (reload) / Đóng tab ➔ Tiếp tục ➔ Hoàn thành**, đảm bảo:
- **Không mất dữ liệu, không nhân đôi kết quả** khi tải lại trình duyệt, rớt mạng hoặc bấm lưu nhiều lần.
- **Có đối chiếu kết quả lần trước** chuẩn xác theo từng bài tập, cấm tuyệt đối so sánh tên gần giống (fuzzy matching).
- **Phân tách bạch giữa Mục tiêu (Target) và Thực tế (Actual)**; ô thực tế ban đầu để trống, việc sao chép từ lần trước bắt buộc phải qua xác nhận của người dùng.
- **Tính toán thời gian tập thực tế** từ mốc `started_at`, `paused_at` và `total_paused_duration_seconds`, không bị trôi khi chuyển tab nền và đóng băng thời gian hoàn toàn khi tạm dừng.

```
                  ┌──────────────────────────────────────────────┐
                  │              Route: /workout                 │
                  └──────────────────────┬───────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [Lượt tập đang dở]                        [Chưa có lượt dở]
      Status: in_progress/paused                              │
                    │                                         ▼
                    ▼                          [Buổi tiếp theo / Chọn CT]
         [ResumeWorkoutCard]                                  │
          Single Primary CTA:                                 ▼
      "Tiếp tục buổi tập dở dang"                   [StartWorkoutButton]
                    │                               Single Primary CTA:
                    └────────────────────┬────────── "Bắt đầu buổi tập"
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │   Route: /workout/[runId]   │
                          │     (ActiveWorkoutView)     │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
[Timestamp Timer]              [Hiệp tập & Outbox]              [Đối chiếu lần trước]
- (now - started_at)           - Target vs Actual               - Exact match bài tập
- Đóng băng khi Pause          - Pending / Saved / Failed       - Loại trừ demo template
- Reload không trôi            - Offline outbox theo user       - Sao chép cần xác nhận
        │                                │                                │
        └────────────────────────────────┼────────────────────────────────┘
                                         │
                                         ▼
                           [Bấm "Hoàn thành buổi tập"]
                                         │
                       ┌─────────────────┴─────────────────┐
                       ▼                                   ▼
             [Còn hiệp chưa tập]                  [Tất cả hiệp đã tập]
           [IncompleteSetsModal]                           │
             - Tiếp tục tập                                │
             - Hoàn thành 1 phần                           │
                       │                                   │
                       └─────────────────┬─────────────────┘
                                         │
                                         ▼
                        [RPC: finalize_workout_run]
                        - Khóa giao dịch FOR UPDATE
                        - Optimistic Concurrency Version
                        - Idempotency Key chống trùng
                        - Ghi nguyên tử: Run + Session Result + Activity nền
                                         │
                                         ▼
                           [WorkoutResultSummary]
                           - Đề xuất: Xem nhật ký / Cây kỹ năng / Cam kết
```

---

## 2. Chi tiết 11 Hạng mục Nghiệm thu Kỹ thuật

### 1. Routes `/workout` và `/workout/[runId]`
* **Route `/workout`:**
  * Thực thi nghiêm ngặt thứ tự ưu tiên:
    1. **Ưu tiên 1:** Lượt tập đang dở dang (`in_progress` hoặc `paused`) ➔ Hiển thị `ResumeWorkoutCard` với CTA duy nhất: **"Tiếp tục buổi tập dở dang"**.
    2. **Ưu tiên 2:** Buổi tiếp theo đã lên lịch / gợi ý ➔ Hiển thị CTA duy nhất: **"Bắt đầu buổi tập: [Tên buổi tập]"**.
    3. **Ưu tiên 3:** Chưa có lộ trình ➔ Hiển thị CTA duy nhất: **"Chọn chương trình tập"** dẫn về `/programs`.
  * **Chỉ một CTA chính theo trạng thái**, loại bỏ tình trạng xung đột nút bấm.
* **Route `/workout/[runId]`:**
  * Màn hình tập luyện tương tác chuyên biệt cho phiên tập `runId`.
  * Khi `completed`: render ngay `WorkoutResultSummary`.
  * Khi `abandoned`: hiển thị thông báo đã hủy và nút quay lại.
  * Khi `in_progress` hoặc `paused`: render `ActiveWorkoutView`.

### 2. Tái sử dụng hợp đồng & Đóng gói Namespace B
* Đọc và kế thừa toàn bộ logic tốt nhất từ `LiveWorkoutModal.tsx`, `SessionResultModal.tsx`, `SessionHistoryList.tsx`, `src/app/programs/actions.ts`.
* Đóng gói toàn bộ mã nguồn mới vào namespace độc lập:
  * `src/features/workout/**`
  * `src/contracts/database-b.types.ts`
  * `supabase/migrations/20261028000011_agent_b_workout_runs.sql`
* Tránh duy trì hai luồng hoàn thành lệch chuẩn: xuất khẩu adapter và component để dashboard / programs tích hợp trực tiếp.

### 3. State Machine & Đóng băng Snapshot Bất biến
* Trạng thái phiên tập rõ ràng: `'in_progress' | 'paused' | 'completed' | 'abandoned'`.
* Khi bắt đầu phiên tập, toàn bộ danh sách bài tập được chụp lại vào trường `exercises_snapshot` (JSONB) của `workout_runs`. Khi tải lại trang hoặc khi Admin thay đổi bài tập trong `sessions`, phiên tập đang diễn ra vẫn giữ nguyên vẹn bài tập ban đầu.

### 4. Tách biệt Target vs Actual & Từng Hiệp có ID Ổn định
* Bảng `workout_sets` lưu từng hiệp với khóa tự nhiên `(user_id, run_id, exercise_index, set_order)`.
* Ô `actual_reps`, `actual_load`, `actual_duration_seconds` **ban đầu hoàn toàn để null**.
* Tính năng "Sao chép lần trước": bắt buộc mở modal xác nhận của người dùng; điền dạng bản nháp để người dùng kiểm tra, tuyệt đối không tự động coi mục tiêu hay dữ liệu sao chép là thành tích khi chưa bấm lưu.

### 5. Lưu từng hiệp lên Server & Outbox Ngoại tuyến Phân tách theo User
* Mỗi hiệp có 4 trạng thái hiển thị rõ:
  * `draft`: Chưa nhập / đang sửa
  * `pending`: Đang gửi lên máy chủ (spinner vàng)
  * `saved`: Máy chủ đã xác nhận lưu thành công (dấu tick xanh)
  * `failed`: Lỗi mạng hoặc ngoại tuyến (thẻ đỏ + nút Thử lại)
* **Tuyệt đối không hiển thị "Đã lưu" khi DB chưa phản hồi thành công.**
* **Outbox ngoại tuyến (`workout-storage.ts`):**
  * Tách biệt nghiêm ngặt theo tài khoản: `calis_workout_outbox_${userId}`.
  * Khi mất mạng, hiệp tập tự động đưa vào hàng chờ cục bộ; khi có mạng (`window.online`) tự động retry với cùng `idempotency_key`.
  * Khi đăng xuất (logout), hàm `clearSensitiveWorkoutCacheForUser(userId)` dọn sạch hàng đợi và bản nháp của user đó. Tài khoản khác đăng nhập trên cùng trình duyệt không đọc hay chạy lại queue của người trước.

### 6. Timer Tính từ Timestamps — Chống Trôi & Chống Gian Lận Giờ
* Hàm thuần `calculateElapsedSeconds(startedAt, pausedAt, totalPausedDurationSeconds, nowMs)`:
  * Khi active: `(now - startedAt) - totalPausedDurationSeconds`.
  * Khi pause: `(pausedAt - startedAt) - totalPausedDurationSeconds`.
  * **Khi pause: Timer đóng băng hoàn toàn**, không tăng thêm một giây nào dù thời gian trôi qua bao lâu.
  * **Tab nền / Reload:** khi mở lại tab hoặc reload, công thức timestamps tự động tính toán thời lượng chính xác, không bị phụ thuộc vào `setInterval`.
  * **Kiểm tra biên an toàn:** server và client giới hạn thời lượng `>= 0` và `<= 86400` giây (24 giờ), chặn đứng việc chỉnh sửa đồng hồ máy tính để ghi thời lượng âm hoặc phi lý.

### 7. Đối chiếu Thành tích Lần trước — CẤM Fuzzy Match
* Hàm `compareExerciseRecords`:
  * Chuẩn hóa tên qua `normalizeExerciseName`.
  * **Chỉ chấp nhận khi khớp chính xác tuyệt đối tên bài, variant, unit và assistance.**
  * Cấm hoàn toàn so khớp tên gần giống (ví dụ: "Hít đất kim cương" không được match với "Hít đất tiêu chuẩn").
  * Nếu dữ liệu cũ chưa map hoặc thiếu biến thể: trả về `hasComparison: false` kèm lý do cụ thể ("Chưa có kết quả cho đúng biến thể này").
  * Phân biệt số liệu demo với số liệu người dùng thực sự nhập.

### 8. Hoàn thành Nguyên tử (RPC `finalize_workout_run`) & Chống Ghi Trùng
* Giao dịch cơ sở dữ liệu khóa dòng `workout_runs` với `FOR UPDATE`.
* **Optimistic Locking:** kiểm tra `version = p_expected_version`. Nếu phiên tập bị thao tác trên tab khác sẽ ném lỗi `CONCURRENCY_ERROR`.
* **Idempotency:** truyền `p_idempotency_key`. Nếu người dùng double click hoặc mạng retry, RPC phát hiện run đã hoàn thành cùng key và trả về ngay kết quả cũ (`idempotent_replay: true`), không sinh ra hai bản ghi trong `session_results` hay `activities`.
* Ghi nguyên tử cả 3 bảng trong một transaction:
  1. `workout_runs`: chuyển `status = 'completed'`, lưu thời lượng thực tế và RPE.
  2. `session_results`: lưu các bài tập thực tế đã hoàn thành.
  3. `activities`: lưu hoạt động nguồn `session_sync` để dashboard và nhật ký cập nhật đồng bộ.

### 9. Xử lý Hiệp Chưa Nhập (Partial Completion)
* Khi bấm hoàn thành mà vẫn còn hiệp trống:
  * Mở `IncompleteSetsModal` hiển thị rõ số hiệp chưa tập.
  * Người dùng có thể chọn: *"Tiếp tục tập"* hoặc *"Hoàn thành một phần"*.
  * Các hiệp chưa tập được đánh dấu `status = 'skipped'`, **tuyệt đối không tự điền số 0 hay mục tiêu thay người dùng**.
  * Bản ghi `session_results` chỉ chứa các hiệp có `actual_reps > 0`.

### 10. Dời lịch & Quy tắc Phiên bản 15/30 Phút
* Hàm `reschedulePlannedSessionAction`:
  * Chỉ cập nhật hoạt động dự kiến (`is_planned = true`).
  * **Bảo toàn 100% lịch sử các buổi tập đã hoàn thành trong quá khứ (`is_planned = false`).**
* Hàm `hasReviewedShortVersion`:
  * Chỉ cho phép chọn phiên bản 15/30 phút khi trong nội dung bài tập có cấu hình `duration_variants` với cờ `reviewed: true`.
  * Tuyệt đối không tự ý cắt xén bài tập và quảng bá là có hiệu quả tương đương.
  * Không tự động điều chỉnh tải trọng theo bệnh sử.

### 11. Âm thanh Web Audio An Toàn
* Sử dụng Web Audio API thuần (`src/lib/sound/workout-sound.ts`), không cần tải file MP3 ngoài.
* Có nút Mute âm thanh và lưu trạng thái.
* Mọi lệnh phát âm thanh đều được bọc `try / catch` an toàn; việc trình duyệt chặn autoplay hoặc lỗi audio policy không bao giờ làm gián đoạn việc lưu dữ liệu hay bộ đếm thời gian.
* Mọi sự kiện âm thanh đều đi kèm hoạt ảnh thị giác (visual indicators, progress ring, badges).

---

## 3. Danh sách Tệp đã Tạo & Sửa đổi

### 3.1. Database Migration & Types
- [`supabase/migrations/20261028000011_agent_b_workout_runs.sql`](file:///c:/Users/admin/Documents/CalisCoaching/supabase/migrations/20261028000011_agent_b_workout_runs.sql): Tạo bảng `workout_runs`, `workout_sets`, các chỉ mục duy nhất và 5 RPCs (`record_workout_set`, `pause_workout_run`, `resume_workout_run`, `abandon_workout_run`, `finalize_workout_run`).
- [`src/contracts/database-b.types.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/contracts/database-b.types.ts): Khai báo kiểu TypeScript phân đoạn độc lập cho Agent B.

### 3.2. Feature Core (`src/features/workout/**`)
- [`src/features/workout/contracts/workout.contract.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/contracts/workout.contract.ts): Types, Zod Schemas, hàm thuần tính timer, so khớp bài tập, quy tắc phiên bản rút gọn.
- [`src/features/workout/hooks/workout-storage.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/hooks/workout-storage.ts): Quản lý localStorage outbox và xóa cache nhạy cảm theo user.
- [`src/features/workout/hooks/useWorkoutTimer.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/hooks/useWorkoutTimer.ts): Hook đồng hồ bấm giờ và đếm ngược thời gian nghỉ.
- [`src/features/workout/hooks/useWorkoutOutbox.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/hooks/useWorkoutOutbox.ts): Hook xử lý hàng đợi ngoại tuyến và tự động retry khi có mạng.
- [`src/features/workout/server/workout-actions.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/server/workout-actions.ts): Các Server Actions bắt đầu, đọc, lưu hiệp, tạm dừng, tiếp tục, hủy bỏ, hoàn tất buổi tập.
- [`src/features/workout/server/workout-adapter.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/server/workout-adapter.ts): Read Adapter cung cấp dữ liệu chứng cứ cho Agent C và Dashboard.
- [`src/features/workout/components/PreviousRecordBadge.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/PreviousRecordBadge.tsx): Huy hiệu đối chiếu lần trước kèm modal xác nhận sao chép.
- [`src/features/workout/components/ExerciseSetRow.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/ExerciseSetRow.tsx): Hàng nhập hiệp với trạng thái pending/saved/failed/draft.
- [`src/features/workout/components/IncompleteSetsModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/IncompleteSetsModal.tsx): Modal xử lý hiệp chưa nhập và hoàn thành một phần.
- [`src/features/workout/components/ResumeWorkoutCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/ResumeWorkoutCard.tsx): Card tiếp tục buổi tập dở dang xuất khẩu cho Dashboard/Programs.
- [`src/features/workout/components/WorkoutResultSummary.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/WorkoutResultSummary.tsx): Tổng kết kết quả và gợi ý 3 bước tiếp theo.
- [`src/features/workout/components/ActiveWorkoutView.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/components/ActiveWorkoutView.tsx): Khung tập luyện trực tiếp hoàn chỉnh.
- [`src/features/workout/index.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/features/workout/index.ts): Điểm xuất khẩu công khai.

### 3.3. App Router Routes
- [`src/app/workout/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/workout/page.tsx): Route `/workout` ưu tiên lượt đang dở ➔ buổi tiếp theo ➔ chọn chương trình (chỉ 1 CTA chính).
- [`src/app/workout/StartWorkoutButton.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/workout/StartWorkoutButton.tsx): Nút kích hoạt bắt đầu buổi tập mới.
- [`src/app/workout/[runId]/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/workout/[runId]/page.tsx): Route `/workout/[runId]` chuyên biệt cho từng phiên tập.

### 3.4. Test Suites
- [`src/tests/agent-b-workout-flow.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-b-workout-flow.test.ts): 12 bài kiểm tra về chuẩn hóa tên, cấm fuzzy match, tách target/actual, bất biến snapshot, quy tắc 15/30 phút.
- [`src/tests/agent-b-timer-and-outbox.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-b-timer-and-outbox.test.ts): 9 bài kiểm tra tính toán timer, đóng băng khi pause, chống trôi reload, cô lập outbox theo user, dọn dẹp khi logout.
- [`src/tests/agent-b-workout-rls.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-b-workout-rls.test.ts): 7 bài kiểm tra Postgres PGlite về RLS, RPCs, optimistic locking, hoàn thành nguyên tử, idempotency.

---

## 4. Kết quả Kiểm thử Thực tế

### 4.1. Toàn bộ Test Suite của Agent B:
```bash
> npx vitest run agent-b

 ✓ src/tests/agent-b-workout-flow.test.ts (12 tests) 15ms
 ✓ src/tests/agent-b-timer-and-outbox.test.ts (9 tests) 16ms
 ✓ src/tests/agent-b-profile-dashboard.test.ts (14 tests) 3251ms
 ✓ src/tests/agent-b-workout-rls.test.ts (7 tests) 3487ms

 Test Files  4 passed (4)
      Tests  42 passed (42)
   Duration  4.52s
```

### 4.2. Toàn bộ Test Suite Toàn Repo:
```bash
> npx vitest run

 Test Files  26 passed (26)
      Tests  292 passed (292)
   Duration  22.20s
```

### 4.3. Kiểm tra Kiểu Dữ Liệu TypeScript:
Tất cả các tệp thuộc phạm vi Agent B (`src/features/workout/**`, `src/app/workout/**`, `src/contracts/database-b.types.ts`) đều đạt **0 lỗi TypeScript**.

---

## 5. Hướng dẫn Tích hợp & Kết nối cho Điều phối

1. **Dashboard (`/dashboard`):**
   * Nhúng component `<ResumeWorkoutCard run={activeRun} />` khi người dùng có phiên tập dở dang.
   * Deep link ổn định: `/workout/[runId]`.
2. **Programs (`/programs`):**
   * Thay thế nút "Tập Live Này" bằng link điều hướng tới `/workout` hoặc gọi `startWorkoutRunAction({ sessionId })`.
3. **Agent C (Hành trình Kỹ năng & Bằng chứng):**
   * Sử dụng read adapter `getCompletedWorkoutRunProof(runId)` từ `src/features/workout/server/workout-adapter.ts` để đọc dữ liệu hoàn thành làm chứng cứ cho kỹ năng.
4. **Cam kết tuân thủ:**
   * Không commit hay push lên production remote. Toàn bộ mã nguồn nằm ở local branch sẵn sàng để điều phối hợp nhất.
