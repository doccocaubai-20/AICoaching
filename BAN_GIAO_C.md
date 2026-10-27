# BÁO CÁO BÀN GIAO AGENT C: NHẬT KÝ HOẠT ĐỘNG (ACTIVITIES)

> **Dự án**: CalisCoaching MVP  
> **Người thực hiện**: Agent C  
> **Thời gian hoàn thành**: 27/10/2026  
> **Phạm vi sở hữu**: `src/app/activities/**`, `src/components/activities/**`, `src/tests/agent-c-*.test.ts`, `BAN_GIAO_C.md`.

---

## 1. Danh sách tệp đã tạo và sửa đổi

### 1.1. Tệp tạo mới thuộc phạm vi của C
- [`src/components/activities/activity-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/activities/activity-utils.ts): Các hàm thuần phục vụ:
  - `localDatetimeToIso(localValue)`: Đổi giờ địa phương từ `<input type="datetime-local">` sang chuỗi chuẩn ISO-8601 có múi giờ tại trình duyệt.
  - `isoToVNDatetimeLocal(isoString)`: Chuyển đổi timestamp ISO sang định dạng `YYYY-MM-DDTHH:mm` theo giờ Việt Nam (`Asia/Ho_Chi_Minh`) để điền sẵn vào input khi sửa.
  - `getVietnamNowDatetimeLocal()`: Lấy ngày giờ hiện tại theo giờ Việt Nam cho form thêm mới.
  - `validateActivityDuration(durationMinutes)`: Kiểm tra thời lượng hợp lệ (số nguyên dương > 0 và <= 1440 phút / 24h).
  - `filterActivities(activities, filters)`: Lọc danh sách theo loại môn (`calisthenics`, `running`, `badminton`, `walking`, `other`) và trạng thái (`actual` - đã tập vs `planned` - lịch dự kiến).
  - Khai báo nhãn tiếng Việt `ACTIVITY_TYPE_LABELS`.
- [`src/app/activities/actions.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/activities/actions.ts): Các Server Actions thao tác dữ liệu:
  - `createActivityAction`: Thêm hoạt động với cơ chế upsert chống ghi trùng (`idempotency_key`), kiểm tra quyền đăng nhập `requireAuthenticatedUser()`, kiểm tra giới hạn thời lượng, revalidate `/activities` và `/dashboard`.
  - `updateActivityAction`: Cập nhật hoạt động theo `id` và `user_id`, giữ nguyên `idempotency_key` ban đầu, trigger DB tự động đánh dấu `review_suggestions` liên quan thành `outdated`.
  - `deleteActivityAction`: Xóa hoạt động theo `id` và `user_id`, kích hoạt trigger đánh dấu gợi ý cũ.
- [`src/components/activities/ActivityItem.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/activities/ActivityItem.tsx): Hiển thị chi tiết từng hoạt động, nhãn phân biệt Đã tập / Lịch dự kiến, định dạng ngày giờ bằng `formatDateVN(start_at, { hour: '2-digit', minute: '2-digit' })`, hiển thị nguồn qua `formatSourceLabel`, ghi chú an toàn (không render HTML), nút Sửa và Xóa (có xác nhận `window.confirm`).
- [`src/components/activities/ActivityList.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/activities/ActivityList.tsx): Danh sách hoạt động có thanh bộ lọc cuộn ngang thân thiện với điện thoại, bộ chuyển trạng thái Tất cả / Đã tập / Lịch dự kiến; trạng thái rỗng ghi rõ "Chưa ghi hoạt động nào" (không ghi "Bạn chưa tập").
- [`src/components/activities/ActivityFormModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/activities/ActivityFormModal.tsx): Modal thêm/sửa hoạt động:
  - Sinh `newIdempotencyKey()` **một lần khi mở modal thêm mới**, giữ trong state.
  - Bấm lưu lặp hoặc thử lại do lỗi mạng sẽ gửi lại đúng khóa này.
  - Khóa form nếu đang ở chế độ sửa mà chưa tải được bản ghi gốc.
  - Giữ nguyên nội dung form khi gặp lỗi và khóa nút trong lúc đang lưu (`isPending`).
- [`src/components/activities/ActivityManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/activities/ActivityManager.tsx): Component điều phối trang, hiển thị tiêu đề, cam kết quy tắc an toàn số liệu, thông báo lỗi truy vấn độc lập và quản lý trạng thái modal.
- [`src/tests/agent-c-activities.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-c-activities.test.ts): Bộ kiểm thử toàn diện cho Agent C.

### 1.2. Tệp sửa đổi
- [`src/app/activities/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/activities/page.tsx): Thay thế khung tĩnh ban đầu bằng trang quản trị hoạt động đầy đủ, bảo vệ phiên qua `getAuthenticatedUser()`, kiểm tra biến môi trường qua `getSupabaseEnvStatus()`, tải danh sách hoạt động sắp xếp mới nhất trước qua RLS, truyền `fetchError` nếu truy vấn thất bại.

### 1.3. Tệp chỉ đọc và tuân thủ
- Sử dụng lại [`src/components/dashboard/date-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/date-utils.ts) (`formatDateVN`, `formatSourceLabel`) mà không sửa đổi.
- Tuyệt đối **không sửa**: `supabase/**`, `src/contracts/**`, `src/lib/**`, `middleware.ts`, `layout.tsx`, và các tệp của Agent B.

---

## 2. Chi tiết hành vi và chức năng đã hoàn thành

| Mục tiêu | Hành vi thực tế | Trạng thái |
|:---|:---|:---:|
| **Thêm hoạt động** | Hỗ trợ 5 môn: calisthenics, chạy bộ, cầu lông, đi bộ, khác. Nhập ngày giờ, thời lượng (phút), mức mệt tùy chọn (1-10) và ghi chú tự do. Có công tắc "Đây là lịch dự kiến". | **Đạt** |
| **Sửa hoạt động** | Mở form điền sẵn dữ liệu, chuyển giờ sang giờ Việt Nam. Cho phép chuyển lịch dự kiến thành đã tập (`is_planned: false`). Giữ nguyên `idempotency_key` ban đầu. | **Đạt** |
| **Xóa hoạt động** | Có hộp thoại xác nhận trước khi xóa. Xóa đúng tài khoản qua `.eq('user_id', user.id)`. | **Đạt** |
| **Chống ghi trùng (Idempotency)** | Sinh `newIdempotencyKey()` một lần khi mở form thêm mới. Lưu bằng `upsert(..., { onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true })`. Nhấn đúp hoặc gửi lại sau lỗi mạng vẫn chỉ tạo 1 dòng. | **Đạt** |
| **Xử lý thời gian** | Đổi sang ISO ngay tại trình duyệt qua `localDatetimeToIso(localValue)` trước khi gửi lên Server Action. Mọi vị trí hiển thị ngày giờ dùng `formatDateVN(value, { hour: '2-digit', minute: '2-digit' })` chuẩn giờ Việt Nam. | **Đạt** |
| **Cập nhật tổng quan** | Sau khi thêm, sửa hoặc xóa đều gọi `revalidatePath('/activities')` và `revalidatePath('/dashboard')`. Trigger database tự động đổi `review_suggestions` sang `outdated`. | **Đạt** |
| **Bộ lọc danh sách** | Lọc theo loại môn (Tất cả, Calisthenics, Chạy bộ, Cầu lông, Đi bộ, Môn khác) và trạng thái (Tất cả, Đã tập, Lịch dự kiến). Hỗ trợ nút đặt lại bộ lọc. | **Đạt** |
| **Xử lý lỗi & Trạng thái rỗng** | Lỗi tải dữ liệu hiện "Không tải được nhật ký, thử lại sau" (không hiện rỗng). Trạng thái rỗng ghi rõ "Chưa ghi hoạt động nào" (không ghi "Bạn chưa tập"). Form sửa bị khóa nếu chưa tải được bản ghi gốc. Lưu lỗi giữ nguyên form. | **Đạt** |
| **An toàn & Ranh giới MVP** | Không tự chẩn đoán y khoa, không tự tính điểm thể lực, không tự đổi lịch tập. Ghi chú người dùng được render text thuần an toàn, chống XSS. | **Đạt** |
| **Giao diện di động** | Đã tối ưu cho màn hình 375px: thanh lọc cuộn ngang `no-scrollbar`, nút bấm chuẩn chạm cảm ứng (>= 40px), modal cuộn nội dung độc lập `max-h-[80vh]`. | **Đạt** |

---

## 3. Lệnh đã chạy và kết quả thực tế

### 3.1. Chạy bộ kiểm thử (`npm run test`)
```bash
> caliscoaching@1.0.0 test
> vitest run

 ✓ src/tests/rls-rules.test.ts (6 tests)
 ✓ src/tests/contracts.test.ts (11 tests)
 ✓ src/tests/server-guard.test.ts (4 tests)
 ✓ src/tests/rls-pglite.test.ts (24 tests)
 ✓ src/tests/agent-b-profile-dashboard.test.ts (14 tests)
 ✓ src/tests/agent-c-activities.test.ts (12 tests)

 Test Files  6 passed (6)
      Tests  71 passed (71)
```
- **12 ca kiểm thử mới của Agent C**:
  - `localDatetimeToIso`: đổi giờ địa phương sang ISO-8601.
  - `isoToVNDatetimeLocal`: chuyển đổi ISO sang giờ Việt Nam `YYYY-MM-DDTHH:mm`.
  - `validateActivityDuration`: kiểm tra thời lượng nguyên dương, tối đa 1440 phút.
  - `filterActivities`: kiểm tra các kịch bản lọc theo môn và kế hoạch.
  - `validateActivityInput`: kiểm tra hợp đồng loại môn, thời lượng, mức mệt 1-10.
  - PGlite RLS & Idempotency: upsert lặp cùng khóa không nhân đôi bản ghi, User B không xem/sửa/xóa được hoạt động của User A, trigger tự động cập nhật `review_suggestions` thành `outdated` khi sửa hoặc xóa hoạt động.

### 3.2. Kiểm tra kiểu dữ liệu TypeScript (`npx tsc --noEmit`)
```bash
> npx tsc --noEmit
# Exit code: 0 - Không có lỗi kiểu dữ liệu
```

### 3.3. Kiểm tra biên dịch ứng dụng (`npm run build`)
```bash
> caliscoaching@1.0.0 build
> next build

   ▲ Next.js 15.5.28
   Creating an optimized production build ...
 ✓ Compiled successfully in 22.9s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size     First Load JS
├ ƒ /activities                             8.1 kB   111 kB
# Exit code: 0 - Biên dịch thành công toàn bộ ứng dụng
```

---

## 4. Phần chưa thử với Supabase thật
- Do dự án chưa được cấu hình biến môi trường kết nối trực tiếp đến cụm Supabase Cloud / local CLI thật, toàn bộ hoạt động đã được kiểm chứng an toàn qua:
  1. Chế độ kiểm tra độc lập (Standalone Mode): Giao diện hiển thị `CredentialStatusBanner` và vô hiệu hóa nút bấm theo quy định khi chưa có cấu hình.
  2. Môi trường cơ sở dữ liệu Postgres thật chạy trên `@electric-sql/pglite`, nạp đầy đủ toàn bộ 3 migration của dự án, kiểm chứng đầy đủ RLS, ràng buộc duy nhất `(user_id, idempotency_key)`, và trigger `trg_activities_mark_suggestions_outdated`.

---

## 5. Đề xuất gửi Agent A (Phụ trách Schema & Hợp đồng)
1. **Ràng buộc giới hạn thời lượng trong Database**:
   - Hiện tại Agent C đã kiểm soát thời lượng buổi tập `<= 1440` phút tại Server Action và hàm thuần `validateActivityDuration`.
   - Đề xuất Agent A có thể bổ sung ràng buộc kiểm tra vào bảng `activities` trong migration tiếp theo nếu thấy phù hợp:
     ```sql
     ALTER TABLE public.activities
     ADD CONSTRAINT chk_activities_duration_max CHECK (duration_minutes <= 1440);
     ```
2. **Cập nhật hợp đồng `validateActivityInput`**:
   - Đề xuất Agent A bổ sung điều kiện `input.duration_minutes <= 1440` vào hàm `validateActivityInput` trong `@/contracts/activity.contract.ts` để đồng bộ kiểm tra cho tất cả các agent khác (Agent D khi tạo buổi tập từ giáo trình mẫu).
