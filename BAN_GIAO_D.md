# BÁO CÁO BÀN GIAO AGENT D: BÀI TẬP CALISTHENICS MINH HỌA & QUY TẮC XEM LẠI LỊCH

> **Dự án**: CalisCoaching MVP  
> **Người thực hiện**: Agent D  
> **Thời gian hoàn thành**: 27/10/2026  
> **Phạm vi sở hữu**: `src/app/programs/**`, `src/components/programs/**`, `src/components/review/**`, `src/tests/agent-d-*.test.ts`, `BAN_GIAO_D.md`.

---

## 1. Danh sách tệp đã tạo và sửa đổi

### 1.1. Tệp tiện ích hàm thuần mới tạo
- [`src/components/programs/program-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/program-utils.ts): Các hàm thuần xử lý:
  - `parseExercises(raw)`: Đọc và làm sạch mảng động tác từ trường `exercises` (JSONB), xử lý an toàn khi JSON bị hỏng hoặc sai cấu trúc, lọc bỏ các phần tử không hợp lệ.
  - `cleanCompletedExercises(rawInput)`: Làm sạch dữ liệu động tác tự khai; loại bỏ các động tác người dùng bỏ trống hoặc không nhập số lần/hiệp; tuyệt đối không lưu số 0.
  - `validateSessionDuration(durationMinutes)`: Kiểm tra thời lượng buổi tập là số nguyên dương hợp lệ (1 <= `duration` <= `MAX_ACTIVITY_DURATION_MINUTES` tức 1440 phút).
- [`src/components/review/review-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/review/review-utils.ts): Hàm thuần đánh giá quy tắc xem lại lịch (P1):
  - `evaluateScheduleReview(activities, now)`: Phát hiện buổi Cầu lông và Calisthenics thực tế diễn ra cách nhau dưới ngưỡng demo 12 giờ (`DEMO_PROXIMITY_THRESHOLD_HOURS = 12`).
  - Xử lý thiếu dữ liệu: trả về `status: 'insufficient_data'` kèm lý do "Chưa đủ thông tin" khi phát hiện thời gian hoặc thời lượng không hợp lệ.
  - Trả về `reference_activity_ids` đã được sắp xếp tăng dần (`.sort()`), phiên bản quy tắc `rule-demo-v1.0` và gắn nhãn `is_demo: true`.

### 1.2. Server Actions
- [`src/app/programs/actions.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/programs/actions.ts):
  - `recordSessionResultAction`: Xác thực `requireAuthenticatedUser()`, kiểm tra thời lượng, lưu `session_results` và chèn một hoạt động `calisthenics` nguồn `session_sync` với **cùng một `idempotency_key`**; revalidate các trang `/programs`, `/activities`, `/dashboard`. Nếu lỗi ở bước đồng bộ hoạt động, giữ nguyên dữ liệu form và cho phép người dùng bấm lưu lại với cùng khóa cũ.
  - `evaluateAndSaveReviewSuggestionAction`: Đánh giá danh sách hoạt động và lưu gợi ý vào `review_suggestions` (status = `pending`). Bỏ qua lỗi trùng `23505` (do index `uq_review_suggestions_active` chặn trùng gợi ý đang còn hiệu lực).
  - `updateReviewSuggestionStatusAction`: Người dùng cập nhật trạng thái gợi ý sang `acknowledged` (Đã xem) hoặc `dismissed` (Bỏ qua).

### 1.3. UI Components
- [`src/components/programs/ProgramHeader.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/ProgramHeader.tsx): Hiển thị tiêu đề chương trình từ database, phiên bản (`1.0.0-demo`), nhãn trạng thái "Minh họa Demo", và biểu ngữ cảnh báo nổi bật: nội dung là minh họa kỹ thuật, chưa được chuyên gia y tế hay HLV rà soát, không phải giáo án để người thật tập theo.
- [`src/components/programs/SessionCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/SessionCard.tsx): Hiển thị từng buổi tập mẫu, danh sách động tác (số hiệp, số lần mục tiêu, thời gian nghỉ) và nút kích hoạt ghi kết quả.
- [`src/components/programs/SessionResultModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/SessionResultModal.tsx): Modal ghi kết quả tự khai:
  - Sinh `newIdempotencyKey()` **một lần khi mở modal**, giữ trong state.
  - Chuyển đổi thời gian sang chuẩn ISO-8601 tại trình duyệt trước khi gửi lên server.
  - Nhập số hiệp/lần thực tế từng động tác (bỏ trống thì loại bỏ, không ghi 0), mức gắng sức 1-10, thời lượng, ghi chú.
  - Giữ form khi gặp lỗi và khóa nút trong lúc lưu (`isPending`).
- [`src/components/programs/SessionHistoryList.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/SessionHistoryList.tsx): Hiển thị lịch sử các kết quả tự khai của người dùng, sắp xếp mới nhất trước, ngày giờ định dạng theo giờ Việt Nam qua `formatDateVN`.
- [`src/components/review/ReviewSuggestionsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/review/ReviewSuggestionsSection.tsx): Hiển thị các gợi ý xem lại lịch:
  - Gắn nhãn rõ ràng: "Quy tắc demo, chưa rà soát chuyên môn • rule-demo-v1.0".
  - Gợi ý đang hiệu lực (`pending` / `acknowledged`): có nút "Đã xem" và "Bỏ qua".
  - Gợi ý cũ (`outdated`): hiển thị nhãn "Dữ liệu nguồn đã thay đổi" do trigger database tự động cập nhật khi hoạt động nguồn bị sửa/xóa.
  - Nút "Kiểm tra lịch ngay" kích hoạt rà soát lịch hoạt động theo quy tắc.
- [`src/components/programs/ProgramsManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/programs/ProgramsManager.tsx): Component điều phối trang `/programs`.

### 1.4. Trang & Kiểm thử
- [`src/app/programs/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/programs/page.tsx): Thay thế khung tĩnh cũ. Tải dữ liệu thật từ database (programs, sessions, session_results, review_suggestions, activities). Hiển thị `CredentialStatusBanner` và khóa chức năng khi chưa cấu hình Supabase. Xử lý lỗi từng truy vấn độc lập.
- [`src/tests/agent-d-programs.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-d-programs.test.ts): Bộ kiểm thử 13 ca kiểm tra hàm thuần, PGlite RLS, Idempotency và Review Suggestion Triggers.

---

## 2. Chi tiết hành vi và chức năng đã hoàn thành

| Hạng mục | Hành vi thực tế | Trạng thái |
|:---|:---|:---:|
| **Nội dung đọc từ DB** | Chương trình và 2 buổi tập mẫu được đọc từ database (`programs` và `sessions` trong seed demo), không viết cứng trong mã. | **Đạt** |
| **Ghi nhận kết quả (P0)** | Người dùng tự khai số hiệp, số lần cho từng động tác, mức gắng sức (1-10), thời lượng (1-1440 phút) và ghi chú. Động tác bỏ trống không ghi 0 mà được loại bỏ sạch sẽ. | **Đạt** |
| **Đồng bộ vào Hồ sơ** | Trong cùng một Server Action, lưu bản ghi vào `session_results` và chèn một hoạt động `calisthenics` nguồn `session_sync` với **cùng một `idempotency_key`**. Trang nhật ký, tổng quan và AI sẽ thấy buổi tập này. | **Đạt** |
| **Chống ghi trùng** | Sinh `newIdempotencyKey()` khi mở modal. Cả hai bảng `session_results` và `activities` đều áp dụng `upsert(..., { onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true })`. Nhấn lưu lặp chỉ tạo đúng 1 bản ghi mỗi bảng. | **Đạt** |
| **Nhãn minh họa bắt buộc** | Tiêu đề luôn kèm nhãn "Minh họa Demo", phiên bản quy tắc `1.0.0-demo`, biểu ngữ cảnh báo nội dung chưa qua rà soát y tế/thể thao và không phải giáo án để người thật tập theo. | **Đạt** |
| **Lịch sử kết quả** | Hiển thị danh sách kết quả đã ghi của chính người dùng, sắp xếp mới nhất trước, ngày giờ định dạng theo giờ Việt Nam. | **Đạt** |
| **Quy tắc xem lại lịch (P1)** | Hàm thuần `evaluateScheduleReview` phát hiện buổi Cầu lông và Calisthenics cách nhau dưới 12 giờ. Trả về `reference_activity_ids` đã được sắp xếp tăng dần, `rule_version: 'rule-demo-v1.0'`, `is_demo: true`. | **Đạt** |
| **Xử lý thiếu dữ liệu lịch** | Nếu phát hiện hoạt động thiếu ngày giờ hoặc thời lượng <= 0, trả về `insufficient_data` với lý do "Chưa đủ thông tin", không tự suy ra giá trị. | **Đạt** |
| **Trigger gợi ý cũ** | Khi hoạt động nguồn bị sửa hoặc xóa bên nhật ký, database trigger tự động đổi trạng thái gợi ý sang `outdated`. UI hiển thị nhãn "Dữ liệu nguồn đã thay đổi". | **Đạt** |
| **Khóa khi lỗi / thiếu cấu hình** | Thiếu cấu hình Supabase thì hiện `CredentialStatusBanner` và khóa nút ghi. Lỗi truy vấn database thì hiện thông báo tiếng Việt, không hiện trạng thái rỗng giả lập. | **Đạt** |

---

## 3. Lệnh đã chạy và kết quả thực tế

### 3.1. Chạy bộ kiểm thử tự động (`npm run test`)
```bash
> caliscoaching@1.0.0 test
> vitest run

 ✓ src/tests/rls-rules.test.ts (6 tests)
 ✓ src/tests/contracts.test.ts (12 tests)
 ✓ src/tests/server-guard.test.ts (4 tests)
 ✓ src/tests/agent-d-programs.test.ts (13 tests)
 ✓ src/tests/rls-pglite.test.ts (26 tests)
 ✓ src/tests/agent-b-profile-dashboard.test.ts (14 tests)
 ✓ src/tests/agent-c-activities.test.ts (12 tests)

 Test Files  7 passed (7)
      Tests  87 passed (87)
```
- **13 ca kiểm thử của Agent D**:
  - `parseExercises`: đọc đúng mảng hợp lệ, xử lý an toàn JSON hỏng, chuỗi lỗi, loại bỏ động tác thiếu tên hoặc sets <= 0.
  - `cleanCompletedExercises`: loại bỏ động tác bỏ trống, không lưu 0.
  - `validateSessionDuration`: kiểm tra thời lượng 1 - 1440 phút, chặn số âm, 0, thập phân, vượt quá 24h.
  - `evaluateScheduleReview`: phát hiện hoạt động sát nhau (< 12h) trả về `needs_review` và IDs sắp xếp tăng dần; cách xa (> 12h) trả về `no_flag`; bỏ qua lịch dự kiến; thiếu dữ liệu trả về `insufficient_data`.
  - PGlite Database Tests:
    - User A đọc chương trình/buổi tập mẫu hệ thống (`user_id IS NULL`).
    - Ghi kết quả và hoạt động đồng bộ với cùng một `idempotency_key`. Lưu lặp cùng khóa ra đúng 1 dòng mỗi bảng.
    - User B không ghi được kết quả cho buổi tập riêng của User A (RLS chặn).
    - Unique index `uq_review_suggestions_active` chặn chèn trùng gợi ý đang hiệu lực (báo lỗi 23505).
    - Sửa hoạt động nguồn tự động kích hoạt trigger chuyển gợi ý sang `outdated`.

### 3.2. Kiểm tra kiểu dữ liệu TypeScript (`npx tsc --noEmit`)
```bash
> npx tsc --noEmit
# Exit code: 0 - Hoàn toàn không có lỗi kiểu dữ liệu
```

### 3.3. Kiểm tra biên dịch ứng dụng (`npm run build`)
```bash
> caliscoaching@1.0.0 build
> next build

   ▲ Next.js 15.5.28
   Creating an optimized production build ...
 ✓ Compiled successfully in 12.7s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size     First Load JS
├ ƒ /programs                               6.7 kB   113 kB
# Exit code: 0 - Biên dịch thành công toàn bộ dự án Next.js
```

---

## 4. Giới hạn đã biết (Known Limitations)
- Hiện tại trong cơ sở dữ liệu chưa có cột khóa ngoại liên kết trực tiếp giữa bảng `session_results` và bảng `activities`. Hai bản ghi được liên kết logic với nhau qua cùng giá trị `idempotency_key`.
- Do đó, nếu người dùng xóa hoạt động calisthenics bên trang Nhật ký (`/activities`), bản ghi kết quả tự khai tương ứng bên `session_results` vẫn được lưu giữ và không bị xóa theo.

---

## 5. Phần chưa thử với Supabase thật
- Do môi trường hiện tại chưa được cung cấp thông tin đăng nhập Supabase Cloud / local CLI có credentials thật, toàn bộ hệ thống đã được kiểm chứng an toàn qua:
  1. Chế độ kiểm tra độc lập (Standalone Mode): Giao diện hiển thị `CredentialStatusBanner` và vô hiệu hóa các nút ghi dữ liệu.
  2. Môi trường Postgres thật qua `@electric-sql/pglite`, nạp đầy đủ toàn bộ 4 migration và tệp `seed_demo.sql`, kiểm chứng đầy đủ RLS, index chống trùng `uq_review_suggestions_active`, và trigger `trg_activities_mark_suggestions_outdated`.

---

## 6. Đề xuất gửi Agent A (Phụ trách Schema & Hợp đồng)
1. **Liên kết giữa Session Results và Activities**:
   - Nếu ở các phiên bản sau MVP muốn có quan hệ ràng buộc toàn vẹn giữa buổi tập và nhật ký hoạt động, đề xuất Agent A bổ sung cột khóa ngoại:
     ```sql
     ALTER TABLE public.session_results
     ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;
     ```
2. **Cập nhật index cho gợi ý xem lại lịch**:
   - Hiện tại index `uq_review_suggestions_active` đã hoạt động tốt với mảng `reference_activity_ids` được sắp xếp tăng dần. Đề xuất Agent A cân nhắc duy trì quy tắc sắp xếp này trong mọi thao tác ghi gợi ý của các agent khác.
