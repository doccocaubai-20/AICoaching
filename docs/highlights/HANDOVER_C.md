# BÀN GIAO TÍNH NĂNG AGENT C: D4 & D6

- **Agent:** Agent C (Kỹ năng & Phương tiện trực quan)
- **Điểm nhấn:**
  - **D4:** Hành trình kỹ năng có bằng chứng (Skill Journey with Evidence)
  - **D6:** Video đối chiếu với chính mình (Self Video Comparison)
- **Ngày bàn giao:** 28/10/2026
- **Trạng thái:** HOÀN TẤT & ĐÃ XÁC MINH KIỂM THỬ (19/19 tests pass, TypeScript 0 lỗi).

---

## 1. TỔNG QUAN GIẢI PHÁP & ĐIỂM NHẤN TRIỂN KHAI

### D4: Hành trình kỹ năng có bằng chứng (`/journey`)
- **Tách bạch 3 khái niệm:** Mở nội dung hướng dẫn, tích lũy điểm kinh nghiệm (XP) và đạt mốc kỹ năng là hoàn toàn độc lập. Mở bài hay nhiều XP **không** tự động cấp trạng thái hoàn thành mốc.
- **4 trạng thái mốc kỹ năng chuẩn:**
  1. `not_attempted`: Chưa có lần thử nào.
  2. `attempted`: Đã có ít nhất 1 lần thử nhưng chưa đạt tiêu chí mốc.
  3. `self_reported_achieved`: Người dùng tự khai đã hoàn thành mốc dựa trên tiêu chí định sẵn (kèm minh chứng số reps/duration và clip nếu có).
  4. `needs_review`: Trạng thái bị đánh dấu xem xét lại khi hoạt động nền (activity / session result) bị chỉnh sửa thời gian, bài tập hoặc bị xóa khỏi hệ thống.
- **Bảo tồn toàn bộ lịch sử lần thử:** Lưu lại cả những lần thử thất bại/chưa đạt để biểu diễn đường cong tiến bộ thực tế của người dùng, không ghi đè mất mát dữ liệu cũ.
- **Hành trình mẫu có sẵn:** `pull_up_mastery` (Chinh phục hít xà đơn từ Dead Hang 30s -> Inverted Row 8 reps -> Negative Pull-up 5 reps -> Standard Pull-up 1 rep) với tiêu chí phiên bản `v1.0.0-pilot`, cờ minh họa `is_demo_illustration = true` và tuyên bố miễn trừ y tế/thể thao rõ ràng.

### D6: Video đối chiếu với chính mình (`/journey/compare`, `/journey/attempts/[id]`)
- **Hạn mức dung lượng nghiêm ngặt (Quota):**
  - Giới hạn từng tệp: Tối đa **20 MiB** (`20,971,520 bytes`), định dạng `video/mp4` hoặc `video/webm`.
  - Tổng dung lượng mỗi người dùng: Tối đa **100 MiB** (`104,857,600 bytes`).
  - RPC Database `reserve_journey_video_upload` tuần tự hóa hạn mức với khóa `pg_advisory_xact_lock` chống race condition gian lận dung lượng.
- **Quy trình tải lên 2 bước an toàn (Reserve -> Upload -> Finalize):**
  - Bước 1 (Reserve): Giữ chỗ trước với URL có hạn 15 phút.
  - Bước 2 (Upload trực tiếp): Tải lên Storage Supabase bucket `comparison_videos`.
  - Bước 3 (Finalize): RPC `finalize_journey_video_upload` xác thực kích thước và chuyển trạng thái sang `ready`.
- **Bảo mật & Cô lập RLS:**
  - Bucket riêng tư `comparison_videos` (tách biệt khỏi `health_documents`).
  - Storage path bắt buộc tiền tố `user_id/filename`.
  - RLS triệt để: Người dùng chỉ đọc/tải video của chính mình, chặn hoàn toàn truy cập chéo.
- **Xóa 2 thì có Tombstone:**
  - `mark_journey_video_for_deletion`: Chuyển trạng thái sang `pending_deletion`, lập tức chặn cấp URL mới và unbind `video_id` trong `journey_attempts` mà **không xóa bỏ** bản ghi lần thử.
  - `confirm_journey_video_deleted`: Cập nhật trạng thái thành `deleted`. RLS ẩn vĩnh viễn video khỏi SELECT của người dùng.
- **Trình phát so sánh song song Side-by-Side:**
  - Cho phép người dùng chọn 2 clip (ví dụ: clip ngày đầu tập vs clip mới nhất).
  - Đồng bộ phát/tạm dừng (Sync Play/Pause), chỉnh tốc độ (0.5x, 1.0x, 1.5x) và gắn ghi chú mốc thời gian (Timestamp Notes) để nhìn rõ cải thiện form/kỹ thuật.

---

## 2. DANH MỤC TỆP ĐÃ TRIỂN KHAI

### Schema & Migration
- `supabase/migrations/20261028000012_agent_c_skills_journey_media.sql`:
  - Bảng `skill_journeys`, `skill_milestones`, `journey_videos`, `journey_attempts`.
  - Các RPC: `reserve_journey_video_upload`, `finalize_journey_video_upload`, `mark_journey_video_for_deletion`, `confirm_journey_video_deleted`, `cleanup_expired_journey_video_reservations`.
  - Trigger `trg_journey_attempts_activity_invalidation` và `trg_journey_attempts_session_result_invalidation`.
  - Thiết lập bucket `comparison_videos` và các RLS policies.

### Types & Contracts
- `src/contracts/database-c.types.ts`: Khai báo types chuẩn Database cho Agent C.
- `src/contracts/database.types.ts` & `src/contracts/index.ts`: Tích hợp vào hệ thống type chung không gây xung đột Supabase Client generic table.
- `src/features/skills/contracts/skills.contract.ts`: Khai báo DTO và interface hành trình kỹ năng, validator `validateRecordAttemptInput`.
- `src/features/media/contracts/media.contract.ts`: Khai báo DTO video, validator `validateReserveUploadInput`, `validateTimestampNoteInput`.

### Backend Server Actions & Adapters
- `src/features/skills/server/skills-actions.ts`:
  - `getSkillJourneysAction`, `getSkillJourneyDetailAction`, `recordMilestoneAttemptAction`, `getMilestoneAttemptsAction`.
- `src/features/media/server/media-actions.ts`:
  - `reserveVideoUploadAction`, `finalizeVideoUploadAction`, `deleteJourneyVideoAction`, `getVideoComparisonPairAction`, `addVideoTimestampNoteAction`.
- `src/features/skills/adapters/skills-adapters.ts`: Chuyển đổi kết quả buổi tập thành minh chứng hành trình (`adaptWorkoutResultToJourneyEvidence`).

### Giao diện Người dùng (UI Components & Pages)
- `src/features/skills/components/JourneySummaryCard.tsx`: Card tóm tắt tiến trình hành trình trên Dashboard.
- `src/features/skills/components/MilestoneCard.tsx`: Card hiển thị mốc với badge trạng thái màu sắc phân biệt rõ ràng.
- `src/features/skills/components/RecordAttemptModal.tsx`: Modal ghi nhận lần thử với reps, duration, video clip upload và disclaimer.
- `src/features/media/components/SideBySideVideoPlayer.tsx`: Trình so sánh video song song 2 cột/ngang dọc trên mobile, có thanh điều khiển đồng bộ và timestamp notes.
- `src/app/journey/page.tsx`: Trang danh sách hành trình kỹ năng (`/journey`).
- `src/app/journey/[journeyId]/page.tsx`: Chi tiết hành trình với tiến độ mốc và nút ghi nhận.
- `src/app/journey/compare/page.tsx`: Trang phòng đối chiếu kỹ thuật video (`/journey/compare`).

### Bộ Kiểm Thử Tự Động (Tests)
- `src/tests/agent-c-journey-media.test.ts`:
  - 19 test cases toàn diện trên engine PGlite mô phỏng PostgreSQL + pgcrypto.
  - Kiểm tra toàn bộ seed data, trigger invalidation, RLS, quota 20 MiB/100 MiB, RPC reservation idempotency, tombstone deletion và validators.

---

## 3. KẾT QUẢ KIỂM THỬ

```text
✓ src/tests/agent-c-journey-media.test.ts (19 tests) 4703ms
  ✓ 1. Seed Data & Hành trình mẫu (D4)
    ✓ hành trình mẫu pull_up_mastery được nạp sẵn với cờ minh họa và disclaimer
    ✓ hành trình pull_up_mastery có đủ 4 mốc kỹ năng chuẩn bị
  ✓ 2. Đa lần thử, trạng thái mốc & tính toán thuần túy (D4)
    ✓ tính toán trạng thái mốc: not_attempted khi chưa có lần thử
    ✓ ít nhất 2 lần thử trên một mốc: 1 chưa đạt -> attempted; 1 đạt -> self_reported_achieved
    ✓ lần thử bị needs_review lập tức chuyển trạng thái mốc thành needs_review
  ✓ 3. Trigger DB tự động Invalidation khi sửa/xóa Hoạt Động (D4)
    ✓ khi sửa thời gian hoạt động nguồn, trigger chuyển lần thử liên quan thành needs_review
    ✓ khi xóa hoạt động nguồn, trigger chuyển lần thử liên quan thành needs_review
  ✓ 4. RLS & Bảo mật cô lập dữ liệu (D4, D6)
    ✓ User B không thể đọc lần thử (attempts) của User A
    ✓ User B không thể sửa hoặc xóa lần thử của User A
    ✓ Anonymous không thể đọc journey_attempts hoặc journey_videos
  ✓ 5. Video Quota & RPC Reservation (D6)
    ✓ hạn mức 20 MiB per file (20,971,520 bytes): từ chối file > 20 MiB
    ✓ RPC reserve thành công và tính quota lũy kế, từ chối vượt 100 MiB
    ✓ RPC finalize xác thực video và chuyển status thành ready
    ✓ User B không thể finalize video của User A
  ✓ 6. Tombstone Deletion & Xóa không mất Lần Thử (D6)
    ✓ đánh dấu xóa (pending_deletion) và unbind video_id nhưng giữ nguyên attempt
  ✓ 7. Local Runnable Cleanup RPC (D6)
    ✓ dọn dẹp các reservation hết hạn (> 15 phút / quá hạn) nhưng giữ nguyên video ready
  ✓ 8. Validators & Adapters (Contracts)
    ✓ validateRecordAttemptInput: từ chối khi thiếu reps và duration
    ✓ validateTimestampNoteInput: từ chối thời gian âm và ghi chú trống hoặc quá dài
    ✓ adaptWorkoutResultToJourneyEvidence: chuyển đổi đúng định dạng SourceRef
```

---

## 4. HƯỚNG DẪN TÍCH HỢP CHO ĐIỀU PHỐI (COORDINATOR)
- **Điểm gắn trên Dashboard:** Nhúng component `<JourneySummaryCard />` vào `src/app/dashboard/page.tsx` ở vị trí ưu tiên sau nhóm cam kết tuần hoặc buổi tập đang dở.
- **Điểm gắn trên Chương trình (`/programs`):** Cung cấp card dẫn tới `/journey` để người dùng trải nghiệm hành trình phát triển kỹ năng calisthenics theo từng mốc bằng chứng.
- **Điều hướng:** Đảm bảo thanh BottomNav hoặc menu có lối tắt thuận tiện tới `/journey` và `/journey/compare`.
