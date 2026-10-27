# BÁO CÁO BÀN GIAO AGENT B: SỬA LỖI VÀ HOÀN THIỆN HỒ SƠ & DASHBOARD

> **Dự án**: CalisCoaching MVP  
> **Người thực hiện**: Agent B  
> **Thời gian bàn giao**: 27/10/2026  
> **Phạm vi sở hữu**: `src/app/profile/**`, `src/app/dashboard/**`, `src/components/profile/**`, `src/components/dashboard/**`, `src/tests/agent-b-*.test.ts`.

---

## 1. Danh sách tệp đã tạo và sửa đổi

### 1.1. Tệp tiện ích mới tạo
- [`src/components/dashboard/stats-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/stats-utils.ts): Hàm thuần `computeWeeklyStats(activities, now)` để tính toán số buổi, tổng phút và số môn trong 7 ngày gần nhất; loại bỏ lịch dự kiến (`is_planned = true`) và hoạt động trong tương lai (`start_at > now`).
- [`src/components/dashboard/date-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/date-utils.ts): Định dạng ngày giờ theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`) qua `formatDateVN`, lấy ngày hôm nay theo giờ Việt Nam `getTodayVNDateString`, ánh xạ nhãn nguồn dữ liệu động `formatSourceLabel`, và hàm kiểm tra khoảng thời gian mục tiêu `validateGoalDates`.

### 1.2. Server Actions & Pages
- [`src/app/profile/actions.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/profile/actions.ts): Bổ sung `updateGoalAction`, áp dụng kiểm tra `validateGoalDates(start, end)` cho cả tạo và sửa mục tiêu; cập nhật `updateProfileAction` lưu chính xác mảng rỗng `[]` cho dụng cụ.
- [`src/app/profile/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/profile/page.tsx): Xử lý lỗi từng truy vấn (`profileError`, `goalsError`, `observationsError`) và truyền prop `fetchError` tương ứng; không tự động điền `['Sàn nhà']` khi danh sách thiết bị rỗng.
- [`src/app/dashboard/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/dashboard/page.tsx): Tách riêng truy vấn thống kê 7 ngày không giới hạn dòng và truy vấn 10 hoạt động gần đây; xử lý lỗi từng khu vực độc lập; hiển thị trạng thái chưa cấu hình theo quy định.

### 1.3. UI Components
- [`src/components/profile/ProfileEditForm.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/profile/ProfileEditForm.tsx): Hỗ trợ prop `fetchError`, loại bỏ tự điền `['Sàn nhà']`, hiển thị nhãn "Chưa chọn dụng cụ", tối ưu form mobile (375px).
- [`src/components/profile/GoalsManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/profile/GoalsManager.tsx): Hỗ trợ prop `fetchError`, thêm nút "Sửa" và form chỉnh sửa nội dung mục tiêu với giá trị điền sẵn, giữ form khi gặp lỗi, áp dụng `formatDateVN`.
- [`src/components/profile/ObservationsManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/profile/ObservationsManager.tsx): Hỗ trợ prop `fetchError`, dùng `getTodayVNDateString()` làm ngày mặc định, hiển thị đơn vị từ `metric_unit` và nhãn nguồn từ `formatSourceLabel(obs.source)`, áp dụng `formatDateVN`.
- [`src/components/dashboard/DashboardStatsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/DashboardStatsSection.tsx): Gọi trực tiếp `computeWeeklyStats(activities)`, hỗ trợ `statsError`, khi chưa cấu hình Supabase hiển thị `—` kèm chú thích "Chưa có dữ liệu".
- [`src/components/dashboard/DashboardGoalsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/DashboardGoalsSection.tsx): Hỗ trợ `goalsError`, sửa nhãn nút thành "+ Thiết lập mục tiêu" (bỏ lặp dấu cộng), áp dụng `formatDateVN`.
- [`src/components/dashboard/DashboardMetricsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/DashboardMetricsSection.tsx): Hỗ trợ `metricsError`, hiển thị đơn vị từ `metric_unit`, nguồn từ `formatSourceLabel(source)`, áp dụng `formatDateVN`.
- [`src/components/dashboard/DashboardActivitiesSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/DashboardActivitiesSection.tsx): Hỗ trợ `activitiesError`, áp dụng `formatDateVN`, sửa lặp dấu cộng.
- [`src/components/dashboard/DashboardAISummaryCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/dashboard/DashboardAISummaryCard.tsx): Hỗ trợ `aiError`, áp dụng `formatDateVN`.

### 1.4. Test Suite
- [`src/tests/agent-b-profile-dashboard.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-b-profile-dashboard.test.ts): Mở rộng toàn diện các ca kiểm thử:
  - Thống kê tuần với > 10 hoạt động trong 7 ngày.
  - Loại trừ lịch dự kiến (`is_planned: true`) và hoạt động trong tương lai.
  - Kiểm tra `validateGoalDates`: từ chối `end_date < start_date`, chấp nhận `end_date >= start_date`.
  - Kiểm tra helper ngày giờ theo giờ Việt Nam và ánh xạ nhãn nguồn.
  - RLS Postgres thật (PGlite): lưu và đọc mảng dụng cụ rỗng `[]`, cập nhật nội dung mục tiêu cá nhân và ngăn chặn can thiệp trái phép giữa User A và B.

---

## 2. Chi tiết xử lý từng lỗi rà soát (Mục 1 – 8)

| STT | Vấn đề được nêu | Cách đã khắc phục | Trạng thái |
|:---:|:---|:---|:---:|
| **1** | **Thống kê 7 ngày bị đếm thiếu** do tính trên `.limit(10)` và tính cả lịch dự kiến tương lai. | Tách truy vấn trong `src/app/dashboard/page.tsx` thành truy vấn riêng: `is_planned = false`, `start_at >= 7 ngày trước` và `<= now()`, không giới hạn số dòng. Đưa toàn bộ tính toán sang hàm thuần `computeWeeklyStats(activities, now)` trong `stats-utils.ts`. Viết test với 14 hoạt động (> 10 dòng) và lịch tương lai/dự kiến. | **Đã hoàn thành** |
| **2** | **Lỗi tải dữ liệu bị hiển thị như "chưa có dữ liệu"** (dashboard & profile). | Kiểm tra thuộc tính `error` của từng truy vấn độc lập (`profileError`, `goalsError`, `observationsError`, `statsActivitiesRes.error`, `aiSummaryRes.error`, `activitiesRes.error`). Khi xảy ra lỗi, khu vực tương ứng hiển thị thông báo tiếng Việt (VD: "Không tải được mục tiêu, thử lại sau.") thay vì giao diện rỗng. Các khu vực khác không bị lỗi vẫn hiển thị bình thường. | **Đã hoàn thành** |
| **3** | **Thiếu sửa nội dung mục tiêu** (PLAN P0: "Lưu/sửa mục tiêu"). | Thêm `updateGoalAction` trong `actions.ts`, xác thực `validateGoalInput`, `requireAuthenticatedUser()`, kiểm tra quyền sở hữu `.eq('user_id', user.id).eq('id', goalId)`. Bổ sung kiểm tra `end_date >= start_date` qua hàm `validateGoalDates` cho cả `updateGoalAction` và `createGoalAction`. UI `GoalsManager.tsx` có nút "Sửa" mở form điền sẵn dữ liệu, giữ form khi gặp lỗi. | **Đã hoàn thành** |
| **4** | **Dụng cụ hiển thị khác dữ liệu đã lưu** (tự điền `['Sàn nhà']`). | Loại bỏ hoàn toàn fallback gán `['Sàn nhà']` trong `ProfileEditForm.tsx` và `src/app/profile/page.tsx`. Khi mảng thiết bị rỗng, hiển thị rõ ràng "Chưa chọn dụng cụ". Kiểm thử PGlite đã xác nhận khi người dùng bỏ chọn hết và lưu, dữ liệu đọc lại vẫn là mảng rỗng `[]`. | **Đã hoàn thành** |
| **5** | **Múi giờ hiển thị** (bị phụ thuộc giờ server). | Tạo helper `formatDateVN` sử dụng `Intl.DateTimeFormat` với `timeZone: 'Asia/Ho_Chi_Minh'` trong `src/components/dashboard/date-utils.ts`. Áp dụng đồng bộ cho mọi vị trí hiển thị ngày tháng: `start_at`, `observed_at`, `created_at`, `start_date`, `end_date`. | **Đã hoàn thành** |
| **6** | **Ngày mặc định trong form chỉ số** lấy theo giờ UTC. | Thay thế `toISOString().split('T')[0]` bằng hàm `getTodayVNDateString()` trong `src/components/dashboard/date-utils.ts`, lấy ngày hôm nay theo giờ Việt Nam (`Asia/Ho_Chi_Minh`) cho giá trị khởi tạo của input `date`. | **Đã hoàn thành** |
| **7** | **Khi chưa cấu hình Supabase** dashboard hiện "0 buổi / 0 phút". | Trong `DashboardStatsSection.tsx`, nếu `isConfigured === false`, các chỉ số số buổi, số phút, số môn hiển thị ký tự `—` kèm chú thích "Chưa có dữ liệu" theo đúng yêu cầu thiết kế. | **Đã hoàn thành** |
| **8** | **Nguồn dữ liệu, đơn vị hiển thị, nút lặp dấu cộng**. | - Nguồn dữ liệu: Dùng `formatSourceLabel(source)` ánh xạ `self_reported` → "Tự khai", `manual_import` → "Nhập thủ công", `wearable` → "Thiết bị đeo", không hardcode chuỗi.<br>- Đơn vị hiển thị: Lấy động từ trường `metric_unit` của bản ghi, không viết cố định.<br>- Nút lặp dấu cộng: Sửa chuỗi nút từ `+ + Thiết lập mục tiêu` thành `+ Thiết lập mục tiêu`. | **Đã hoàn thành** |

---

## 3. Lệnh đã chạy và kết quả thực tế

### 3.1. Kiểm thử tự động (`npm run test`)
```bash
> caliscoaching@1.0.0 test
> vitest run

 ✓ src/tests/rls-rules.test.ts (6 tests)
 ✓ src/tests/contracts.test.ts (10 tests)
 ✓ src/tests/server-guard.test.ts (4 tests)
 ✓ src/tests/rls-pglite.test.ts (23 tests)
 ✓ src/tests/agent-b-profile-dashboard.test.ts (14 tests)

 Test Files  5 passed (5)
      Tests  57 passed (57)
```
- **Kết quả**: Toàn bộ 57/57 ca kiểm thử đều đạt (`Passed`). 14 ca kiểm thử chi tiết của Agent B bao quát đầy đủ logic tính toán tuần, validate ngày mục tiêu, múi giờ Việt Nam, và RLS isolation trên Postgres thật (PGlite).

### 3.2. Kiểm tra kiểu tĩnh TypeScript (`npx tsc --noEmit`)
```bash
> npx tsc --noEmit
# Exit code: 0, không có lỗi kiểu dữ liệu
```

### 3.3. Kiểm tra biên dịch ứng dụng (`npm run build`)
```bash
> caliscoaching@1.0.0 build
> next build

   ▲ Next.js 15.5.28
   Creating an optimized production build ...
 ✓ Compiled successfully in 28.3s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...
# Exit code: 0
```
- Toàn bộ các route `/profile`, `/dashboard`, `/login`, `/register`, `/ai`, `/activities` đều được tối ưu và biên dịch thành công.

---

## 4. Kiểm tra giao diện trên màn hình di động (375px)
- **Trang `/profile`**:
  - Khối biểu mẫu cập nhật thông tin tự động thích ứng với chiều rộng 375px, lưới ngày tập `grid-cols-4 sm:grid-cols-7` và khung giờ tập hiển thị trực quan, không phát sinh thanh cuộn ngang.
  - Danh sách mục tiêu và form sửa mục tiêu hiển thị nút bấm kích thước tối thiểu 44px, thân thiện với thao tác chạm trên điện thoại.
  - Thẻ chỉ số thể chất xếp theo lưới 2 cột co giãn gọn gàng.
- **Trang `/dashboard`**:
  - Bộ 3 chỉ số tuần (buổi, phút, môn) hiển thị dạng 3 thẻ nhỏ tinh gọn, chữ số to rõ ràng.
  - Thẻ tóm tắt AI và danh sách hoạt động gần đây căn lề an toàn theo chuẩn mobile-first.

---

## 5. Phần chưa thử với Supabase thật
- Do môi trường hiện tại chưa được cung cấp thông tin đăng nhập Supabase thật (`NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`), toàn bộ các thao tác đã được xác thực an toàn qua:
  1. Cơ chế fallback hiển thị trạng thái thiếu thông tin đăng nhập (`CredentialStatusBanner` và nhãn `—` / "Chưa có dữ liệu").
  2. Môi trường kiểm thử Postgres nội bộ tích hợp RLS thật qua `@electric-sql/pglite` với toàn bộ các migration chính thức.
- Khi triển khai lên môi trường có Supabase thật, chỉ cần điền biến môi trường vào `.env.local` mà không cần sửa đổi bất kỳ dòng mã nguồn nào.

---

## 6. Đề xuất gửi Agent A (Phụ trách Schema & Hợp đồng)
1. **Kiểm tra ràng buộc ngày mục tiêu ở mức cơ sở dữ liệu**:
   - Hiện tại Agent B đã thực hiện kiểm tra `end_date >= start_date` tại tầng Server Actions và UI (`validateGoalDates`).
   - Đề xuất Agent A có thể bổ sung ràng buộc kiểm tra vào bảng `goals` trong migration tiếp theo:
     ```sql
     ALTER TABLE public.goals
     ADD CONSTRAINT check_goal_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
     ```
2. **Cập nhật hợp đồng `validateGoalInput`**:
   - Đề xuất Agent A đưa logic kiểm tra ngày `end_date >= start_date` vào trong hàm `validateGoalInput` thuộc `@/contracts` để dùng chung thống nhất cho tất cả các agent khác.
