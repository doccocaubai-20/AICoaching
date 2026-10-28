# BIÊN BẢN BÀN GIAO KỸ THUẬT — AGENT C
## D4: Hành Trình Kỹ Năng Có Bằng Chứng + D6: Video Đối Chiếu Với Chính Mình

- **Mã đại diện (Agent):** Agent C
- **Thời điểm hoàn thành:** 28/10/2026
- **Base Commit (BASE_SHA READY):** `56d50f21cdb110744f4f65ca920ed64aa0306ba6`
- **Ownership phân định:**
  - `src/features/skills/**`
  - `src/features/media/**`
  - `src/app/journey/**`
  - `src/contracts/database-c.types.ts`
  - `supabase/migrations/20261028000012_agent_c_skills_journey_media.sql`
  - `src/tests/agent-c-journey-media.test.ts`
  - `docs/highlights/HANDOVER_C.md`

---

## 1. TỔNG QUAN TÍNH NĂNG ĐÃ THỰC HIỆN

### 1.1. D4 — Hành Trình Kỹ Năng Có Bằng Chứng (Skill Journey)
1. **Route `/journey`:**
   - Trưng bày hành trình chuẩn hóa mẫu: **Chinh phục Hít xà đơn (`pull_up_mastery`)** với `criteria_version: 'v1.0.0-pilot'`.
   - Có banner cảnh báo rõ ràng: *"Tiêu chuẩn minh họa dành cho giai đoạn pilot, chưa qua rà soát của chuyên gia thể thao; người tập tự chịu trách nhiệm về an toàn khi áp dụng."*
   - Gồm 4 mốc kế thừa chuẩn xác:
     - `dead_hang_30s`: Dead Hang (Treo xà tĩnh kích hoạt khớp vai, 30s)
     - `inverted_row_8`: Inverted Row (Kéo xà nghiêng / Australian Pull-up, 8 reps)
     - `negative_pull_up_5`: Negative Pull-up (Hít xà hạ chậm có kiểm soát, 5 reps)
     - `standard_pull_up_1`: Standard Pull-up (Hít xà đơn tiêu chuẩn, 1 rep)
2. **Hệ thống 4 trạng thái mốc độc lập hoàn toàn:**
   - `not_attempted`: Chưa từng thử.
   - `attempted`: Đã thử nhưng chưa đạt tiêu chí mốc.
   - `self_reported_achieved`: Người dùng tự ghi nhận đạt mốc (kèm hoặc không kèm chứng cứ).
   - `needs_review`: Hoạt động nền hoặc kết quả buổi tập liên kết đã bị sửa hoặc xóa.
   - **Quy tắc bất biến:** Mở nội dung bài tập, nhận XP và đạt mốc là ba việc tách biệt hoàn toàn; không dùng tổng buổi tập hay tổng XP để tự động cấp danh hiệu "Verified".
3. **Ghi nhận lần thử (Attempts):**
   - Lưu trữ lịch sử toàn diện (cả lần đạt và chưa đạt) để theo dõi tiến trình qua thời gian.
   - Thông tin lần thử: `attempted_at`, `exercise_id`, `variant_id`, `assistance`, số lần thực hiện (`actual_reps`) hoặc thời lượng (`actual_duration_seconds`), ghi chú kỹ thuật (`notes`), tự nhận định (`is_achieved_self_reported`).
   - Hỗ trợ gắn chứng cứ nền (`activities` hoặc `session_results` từ Agent B) mà user có quyền sở hữu.
4. **Cơ chế Invalidation tự động (Database Triggers):**
   - Trigger `trg_journey_attempts_activity_invalidation` trên bảng `activities`: Khi user chỉnh sửa (thay đổi `duration_minutes`, `start_at`, `activity_type`) hoặc xóa hoạt động nền, toàn bộ lần thử liên kết lập tức chuyển trạng thái sang `needs_review`, cập nhật `source_invalidated_at` và lý do `source_invalidation_reason`.
   - Trigger `trg_journey_attempts_session_result_invalidation` trên bảng `session_results`: Hành vi tương tự cho kết quả buổi tập Agent B.
   - Đường dẫn bằng chứng cũ không còn hiển thị như chứng cứ hiện hành, cảnh báo user cần tự đánh giá lại.

---

### 1.2. D6 — Video Đối Chiếu Với Chính Mình (Self-Comparison Video)
1. **Video là tùy chọn (Optional):**
   - Người dùng hoàn toàn có thể ghi nhận lần thử mà không cần tải lên video.
2. **Tách biệt Storage & Metadata:**
   - Sử dụng Bucket Supabase Storage riêng biệt: `comparison_videos` (Private Bucket, **hoàn toàn không mở rộng bảng `health_documents` hay bucket tài liệu y tế**).
   - Ràng buộc DB Constraint: `journey_videos_storage_path_user_prefix CHECK (storage_path LIKE (user_id::TEXT || '/%'))`.
3. **Kiến trúc Tải lên trực tiếp qua Signed Upload URL (Không qua Server Action):**
   - Server Action `reserveVideoUploadAction` giữ chỗ quota trong DB (`pg_advisory_xact_lock`), cấp đường dẫn ngẫu nhiên an toàn `${user.id}/${randomUUID}.${ext}` và signed upload URL.
   - Client PUT tệp trực tiếp lên Supabase Storage qua signed upload URL (vượt qua giới hạn 4.5 MB body của Next.js Server Action).
   - Client gọi `finalizeVideoUploadAction`: Server kiểm tra đối tượng thực sự tồn tại trong Storage, kích thước byte thực tế, MIME type thực tế, đúng user sở hữu rồi mới chuyển `status = 'ready'`.
   - Cơ chế Idempotency: Gửi kèm `idempotency_key` tránh tạo bản ghi trùng hoặc trừ quota 2 lần khi mạng chập chờn retry.
4. **Chỉ số Quota thực tế & Hạn mức rõ ràng:**
   - **Giới hạn tệp:** Tối đa **20 MiB / file** (`20,971,520` integer bytes).
   - **Giới hạn tài khoản:** Tối đa **100 MiB / user** (`104,857,600` integer bytes).
   - **Định dạng container/codec hỗ trợ:** `video/mp4` và `video/webm`.
   - **Thời lượng:** Gợi ý 15–30 giây; chỉ lưu estimated duration do client cung cấp, **tuyệt đối không tuyên bố đã validate duration phía server**.
5. **Quyền riêng tư & Bảo mật (Privacy & RLS):**
   - Video hoàn toàn riêng tư: Chỉ chính user mới có quyền đọc và xóa video của mình.
   - Nhóm D (Accountability Groups) và người dùng khác **không có quyền xem** clip đối chiếu.
   - Signed URL xem video có TTL ngắn: **300 giây (5 phút)**.
   - Tuyên bố minh bạch trong UI: URL đã cấp có thể phát được cho đến khi hết TTL 300s.
6. **Xóa 2 thì an toàn (Tombstone Deletion & Dual Write Safety):**
   - Khi xóa video, DB chuyển trạng thái sang `status = 'pending_deletion'` ngay lập tức.
   - Video ở trạng thái `pending_deletion` **bị cấm cấp mới signed URL**.
   - Server xóa object trên Storage:
     - Nếu thành công: DB chuyển `status = 'deleted'`.
     - Nếu Storage lỗi: DB ghi nhận `deletion_failed = true`, tăng `deletion_attempts` và lưu `deletion_error` để dọn dẹp retry.
   - **Quan trọng:** Xóa video chỉ unbind `video_id = NULL` trên `journey_attempts`, **tuyệt đối không xóa lần thử của người dùng**.
7. **Trình phát đối chiếu song song (`/journey/compare`):**
   - Hai clip cùng bài tập / biến thể được đặt cạnh nhau (Side-by-Side).
   - Điều khiển độc lập cho từng clip: Play/Pause, Âm lượng, Tốc độ phát (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
   - Điểm đồng bộ (Sync Points): Người dùng có thể chọn mốc bắt đầu chuyển động ở từng clip (ví dụ: mốc bắt đầu kéo cằm) và bấm "Phát đồng bộ từ mốc".
   - Tuyên bố kỹ thuật rõ ràng: *"Đồng bộ trình duyệt phụ thuộc vào hiệu năng thiết bị và bộ giải mã video HTML5, không đảm bảo khớp chính xác từng khung hình (frame-accurate)."*
   - Ghi chú timestamp: Thêm ghi chú tại giây bất kỳ, bấm vào ghi chú nhảy ngay đến mốc thời gian.
   - Tệp hỏng / không phát được: Báo lỗi lịch sự, cho phép xóa video hỏng mà không làm mất kết quả buổi tập.
8. **Dọn dẹp Abandoned Reservations:**
   - Hàm RPC `cleanup_expired_journey_video_reservations()` dọn dẹp các bản ghi `reserved` quá hạn (> 1 giờ) không được finalize.
   - Đã bàn giao Server Action `cleanupExpiredVideoReservationsAction()` có thể gọi định kỳ ở local/cron runner nội bộ (không tạo cron cloud độc đoán).
9. **Nguyên tắc Đạo đức AI:**
   - **Không AI chấm form, không skeleton tracking, không nhận diện chấn thương, không chấm điểm sức mạnh.**
   - Tuyệt đối không gửi video sang mô hình AI/LLM.

---

## 2. MANIFEST DANH MỤC TỆP TIN ĐÃ TẠO VÀ CHỈNH SỬA

### 2.1. Cấu trúc Database & Migration
- `supabase/migrations/20261028000012_agent_c_skills_journey_media.sql`:
  - Bảng `skill_journeys`: Lưu định nghĩa hành trình, phiên bản tiêu chí, cờ minh họa, disclaimer.
  - Bảng `skill_milestones`: Lưu các mốc kỹ năng, thứ tự `sequence_order`, bài tập, biến thể, tiêu chuẩn hỗ trợ, reps/seconds.
  - Bảng `journey_videos`: Lưu metadata video clip đối chiếu, `status` (reserved/ready/pending_deletion/deleted), quota bytes, check constraint tiền tố user_id.
  - Bảng `journey_attempts`: Lưu lịch sử lần thử, chỉ số reps/duration, tự nhận định, `source_ref`, trạng thái `needs_review`, liên kết `video_id`.
  - Các RPC an toàn:
    - `reserve_journey_video_upload` (kèm `pg_advisory_xact_lock` chống race condition vượt quota 100 MiB)
    - `finalize_journey_video_upload` (xác thực size & mime thực tế)
    - `mark_journey_video_for_deletion` (tombstone)
    - `confirm_journey_video_deleted` (xác nhận xóa hoặc ghi nhận retry)
    - `cleanup_expired_journey_video_reservations` (dọn dẹp reservation mồ côi)
  - Các Trigger Invalidation:
    - `trg_journey_attempts_activity_invalidation` trên `activities`
    - `trg_journey_attempts_session_result_invalidation` trên `session_results`
  - Dữ liệu Seed: Hành trình `pull_up_mastery` và 4 mốc chuẩn bị.
- `src/contracts/database-c.types.ts`:
  - Khai báo kiểu Fragment độc lập cho Agent C (`AgentCDatabaseTypes`, `AgentCFunctionTypes`), đầy đủ `Relationships: []`.

### 2.2. Contracts & Business Logic
- `src/features/skills/contracts/skills.contract.ts`:
  - Types: `MilestoneStatus`, `ExerciseRef`, `SourceRef`, `EvidencePickerItem`, `SkillMilestone`, `SkillJourney`, `JourneyAttempt`, `RecordAttemptInput`, `JourneySummary`, `JourneyDetails`.
  - Hàm thuần túy: `validateRecordAttemptInput`, `calculateMilestoneStatus`, `adaptWorkoutResultToJourneyEvidence`.
- `src/features/media/contracts/media.contract.ts`:
  - Hạn mức: `MAX_VIDEO_FILE_BYTES = 20_971_520`, `MAX_TOTAL_MEDIA_QUOTA_BYTES = 104_857_600`, `SIGNED_URL_TTL_SECONDS = 300`.
  - Types: `AllowedVideoMimeType`, `JourneyVideoAsset`, `TimestampNote`, `ReserveUploadInput`, `FinalizeUploadInput`.
  - Hàm thuần túy: `validateReserveUploadInput`, `validateTimestampNoteInput`, `mapToVideoAsset`.

### 2.3. Server Actions
- `src/features/skills/server/skills-actions.ts`:
  - `getJourneyDetailsAction(journeyId)`: Đọc chi tiết hành trình, danh sách mốc, tính toán trạng thái và lịch sử.
  - `recordMilestoneAttemptAction(input)`: Ghi nhận lần thử, kiểm tra quyền sở hữu đối với `sourceRef` và `videoId`.
  - `deleteAttemptAction(attemptId)`: Xóa lần thử thuộc quyền sở hữu của user.
  - `getJourneySummary(journeyId)`: Xuất tóm tắt metadata nhẹ (không tạo URL ký hàng loạt).
- `src/features/media/server/media-actions.ts`:
  - `reserveVideoUploadAction(input)`: Giữ chỗ quota, cấp grant upload Storage.
  - `finalizeVideoUploadAction(input)`: Xác thực tệp trên Storage và chuyển trạng thái `ready`.
  - `getComparisonVideoSignedUrlAction(videoId)`: Cấp signed URL TTL 300s, chặn cấp nếu video đang `pending_deletion`.
  - `deleteComparisonVideoAction(videoId)`: Xóa 2 thì có tombstone và cơ chế retry khi Storage thất bại.
  - `addVideoTimestampNoteAction`, `removeVideoTimestampNoteAction`: Quản lý ghi chú gắn mốc thời gian.
  - `cleanupExpiredVideoReservationsAction`: Local runner dọn dẹp reservation quá hạn.

### 2.4. Giao diện Người dùng (UI Components)
- `src/features/skills/components/`:
  - `JourneyHeader.tsx`: Tiêu đề, phiên bản tiêu chí, thanh tiến độ 4 trạng thái, banner tuyên bố minh họa và nguyên tắc độc lập.
  - `MilestoneCard.tsx`: Thẻ mốc kỹ năng, tiêu chí mô tả, huy hiệu trạng thái (4 màu riêng biệt), cảnh báo `needs_review`, lần thử mới nhất, nút mở lịch sử và nút ghi nhận lần thử.
  - `EvidencePicker.tsx`: Modal chọn chứng cứ nền từ hoạt động cá nhân (`activities`) hoặc buổi tập (`session_results`).
  - `AttemptRecordModal.tsx`: Form ghi lần thử hỗ trợ reps/duration, hỗ trợ (assistance), ghi chú, tự nhận đạt, gắn chứng cứ và đính kèm video đối chiếu.
  - `JourneySummaryCard.tsx`: Component xuất khẩu cho Dashboard / Programs.
- `src/features/media/components/`:
  - `VideoUploadDropzone.tsx`: Dropzone kéo thả tải video trực tiếp lên Storage, hiển thị thanh tiến độ %, kiểm tra dung lượng 20 MiB và định dạng MP4/WebM.
  - `ComparisonVideoPlayer.tsx`: Trình phát video kép Side-by-Side, điều khiển tốc độ 0.5x-2x, đồng bộ điểm bắt đầu, ghi chú timestamp tương tác, thông báo lỗi tệp hỏng không mất kết quả.

### 2.5. Routes App Router
- `src/app/journey/page.tsx`: Server Component trang chủ hành trình `/journey`.
- `src/app/journey/JourneyClientContainer.tsx`: Quản lý tương tác modal ghi lần thử và chọn chứng cứ.
- `src/app/journey/attempts/[id]/page.tsx`: Chi tiết lần thử, thông tin chứng cứ nền và phát video đối chiếu đính kèm.
- `src/app/journey/compare/page.tsx`: Màn hình đối chiếu 2 video clip song song từ 2 lần thử khác nhau của cùng bài tập/biến thể.

### 2.6. Barrels Export
- `src/features/skills/index.ts`
- `src/features/media/index.ts`

---

## 3. CÁC ĐIỂM XUẤT KHẨU TÍCH HỢP (CONTRACT EXPORTS)

Để đội ngũ điều phối và các Agent khác tích hợp sau giai đoạn chạy song song:

```typescript
// 1. Component thẻ tóm tắt tích hợp vào Dashboard hoặc /programs
import { JourneySummaryCard } from '@/features/skills';
<JourneySummaryCard journeyId="pull_up_mastery" />

// 2. Hàm đọc metadata tóm tắt nhẹ (không tạo signed URL hàng loạt)
import { getJourneySummary } from '@/features/skills';
const summary = await getJourneySummary('pull_up_mastery');
// Output: { journeyId, title, totalMilestones, achievedCount, needsReviewCount, attemptedCount, criteriaVersion, isDemoIllustration }

// 3. Component bộ chọn chứng cứ nền
import { EvidencePicker } from '@/features/skills';
<EvidencePicker onSelect={(evidence) => ...} onCancel={() => ...} />

// 4. Hook adapter cho kết quả buổi tập Agent B
import { adaptWorkoutResultToJourneyEvidence } from '@/features/skills';
const sourceRef = adaptWorkoutResultToJourneyEvidence({
  resultId: workoutRun.id,
  completedAt: workoutRun.completed_at,
  sessionId: workoutRun.session_id,
});
// Gắn sourceRef vào recordMilestoneAttemptAction
```

> [!IMPORTANT]
> **Cam kết không sửa `SkillTreeSection.tsx`:** Agent C không can thiệp hay sửa đổi file `SkillTreeSection.tsx` trong giai đoạn song song; điều phối viên sẽ thay thế cây kỹ năng XP cũ bằng `JourneySummaryCard` hoặc dẫn link vào `/journey`.

---

## 4. BẢNG CHECKLIST NGHIỆM THU (ACCEPTANCE CRITERIA)

| Hạng mục nghiệm thu | Trạng thái | Minh chứng kiểm thử |
|---|---|---|
| **1 mốc có ít nhất 2 lần thử, 1 chưa đạt** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 2 |
| **Không tự đạt khi mở bài hoặc tích lũy XP** | ✅ Đạt | Không có trigger tự cấp `self_reported_achieved` từ XP |
| **Sửa/xóa hoạt động nền chuyển lần thử sang `needs_review`** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 3 (Trigger DB) |
| **User A upload clip, User B không truy cập được (RLS)** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 4 (RLS test) |
| **Từ chối liên kết chứng cứ nền thuộc user khác** | ✅ Đạt | `skills-actions.ts` kiểm tra ownership của `sourceId` |
| **Chặn file vượt quá 20 MiB per file** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 5 (`20,971,520` bytes) |
| **Chặn tổng dung lượng tài khoản vượt quá 100 MiB** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 5 (RPC DB lock) |
| **Idempotency key chống tạo trùng reservation** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 5 (Idempotency) |
| **Tombstone deletion: pending_deletion chặn cấp URL mới** | ✅ Đạt | `media-actions.ts` kiểm tra `status !== 'pending_deletion'` |
| **Xóa Storage lỗi cho phép retry, xóa video KHÔNG xóa attempt** | ✅ Đạt | `agent-c-journey-media.test.ts` > Suite 6 |
| **Hai clip phát cạnh nhau, đồng bộ từ mốc, chỉnh tốc độ** | ✅ Đạt | `ComparisonVideoPlayer.tsx` + `/journey/compare` |
| **Tuyên bố giới hạn đồng bộ trình duyệt, không AI video** | ✅ Đạt | Banner UI cảnh báo rõ ràng; 0 dòng mã AI video |
| **Local cleanup runnable cho expired reservations** | ✅ Đạt | `cleanup_expired_journey_video_reservations()` RPC |
| **Typecheck & Production Build thành công** | ✅ Đạt | `next build` exit code 0, 3 route mới được tạo |
| **Toàn bộ test suite dự án pass 100%** | ✅ Đạt | 311/311 tests passed across 27 suites |

---

## 5. HƯỚNG DẪN VẬN HÀNH DỌN DẸP NỘI BỘ (LOCAL CLEANUP RUNNER)

Nếu cần chạy tác vụ dọn dẹp các lượt giữ chỗ upload bị bỏ dở hoặc video xóa dở dang ở môi trường nội bộ, gọi hàm sau:

```typescript
import { cleanupExpiredVideoReservationsAction } from '@/features/media';

// Chạy tác vụ dọn dẹp
const result = await cleanupExpiredVideoReservationsAction();
console.log(`Đã dọn dẹp ${result.data?.cleanedCount} lượt giữ chỗ hết hạn.`);
```

---

## 6. KẾT LUẬN & CAM KẾT
- Tất cả mã nguồn, migrations, tests và tài liệu bàn giao đều tuân thủ nguyên tắc cách ly module, không vi phạm ownership của các Agent A, B, D.
- Không tự ý tạo cron cloud hoặc sửa đổi database production.
- Sẵn sàng để thực hiện local git commit và bàn giao cho điều phối viên.
