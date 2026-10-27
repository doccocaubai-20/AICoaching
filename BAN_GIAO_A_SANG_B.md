# Bàn giao A → B (Hồ sơ và dashboard)

Cập nhật 27/10/2026. Nền A đã sửa sau rà soát; B có thể bắt đầu. C có thể làm song song trên tệp khác.

## 1. Trạng thái nền A

| Hạng mục | Trạng thái |
|---|---|
| Schema + RLS 12 bảng | 2 migration trong `supabase/migrations/` |
| RLS chạy trên Postgres (PGlite) | Đã chạy, 23 test qua (`src/tests/rls-pglite.test.ts`) |
| RLS trên Supabase thật | **Chưa chạy**: chưa có Supabase local/Cloud |
| Đăng nhập, đăng ký, đăng xuất, middleware phiên | Có; chưa thử với Supabase thật |
| `npm run test` / `npx tsc --noEmit` / `npm run build` | 43/43 qua / không lỗi / thành công |
| `npm run lint` | Chưa dùng được, chưa cấu hình ESLint |

## 2. Tệp B sở hữu

- `src/app/profile/**`: trang hồ sơ, mục tiêu, chỉ số tự khai, server actions của B.
- `src/app/dashboard/**`: trang tổng quan.
- `src/components/profile/**`, `src/components/dashboard/**`: tạo mới khi cần.

**Không sửa:** `supabase/**`, `src/contracts/**`, `src/lib/**`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/(auth)/**`, `src/app/activities/**` (của C). Cần đổi schema/contract thì gửi đề xuất cho A (README §5).

## 3. Dữ liệu B dùng

Import từ `@/contracts`:

- **`profiles`** (`ProfileEntity`, `validateProfileInput`): `display_name`, `experience_level`, `schedule_availability` (JSON), `available_equipment` (mảng). Mỗi người dùng có sẵn **một** dòng (trigger tạo khi đăng ký), nên trang hồ sơ là **sửa**, không phải tạo. Vẫn xử lý trường hợp chưa có dòng bằng `upsert` theo `user_id`.
- **`goals`** (`GoalEntity`, `validateGoalInput`): thêm, sửa, đổi trạng thái, xóa. Ngày bắt đầu/kết thúc tùy chọn.
- **`observations`** (`ObservationEntity`, `validateObservationInput`): chiều cao/cân nặng **tùy chọn**. Không nhập thì không có dòng nào, **không** lưu 0. Mỗi lần nhập là một dòng có `observed_at` và `source`; hiển thị cả hai.
- **`activities`**: B **chỉ đọc** để hiển thị trên dashboard. Thêm/sửa/xóa thuộc C. Khi chưa có dữ liệu thì hiển thị trạng thái rỗng.
- **`ai_summaries`**: dashboard có thể đọc bản mới nhất (chỉ đọc). Hiển thị `created_at` và nhãn `template_fallback` / `ai_generated`.

## 4. Cách đọc/ghi

- Dùng Server Component hoặc Server Action với `createServerSupabaseClient()` (`@/lib/supabase/server`), chạy với quyền người dùng nên RLS có hiệu lực.
- Ở mọi action, gọi `requireAuthenticatedUser()` trước và lấy `user_id` từ phiên, **không** lấy từ form.
- **Không** dùng `createAdminSupabaseClient()`, vì client này chỉ dành cho bảng AI của E.
- Khi thiếu cấu hình (`getSupabaseEnvStatus().isConfigured === false`): hiển thị `CredentialStatusBanner`, vô hiệu nút lưu, không giả lập dữ liệu.
- Số tổng hợp trên dashboard (tổng phút, số buổi trong tuần…) **tính khi đọc**, không lưu bảng riêng. Nhờ vậy C sửa/xóa hoạt động thì số tự cập nhật.

## 5. Việc của B (theo PLAN_MVP.md và PROMPT_AGENT_MVP.md)

1. Trang hồ sơ: sửa tên, kinh nghiệm, lịch rảnh, dụng cụ. Không hỏi bệnh án.
2. Mục tiêu: thêm/sửa/đổi trạng thái/xóa.
3. Chỉ số tự khai: thêm/xóa chiều cao, cân nặng theo ngày và nguồn.
4. Dashboard: thay khối hard-code "Mục tiêu Calisthenics cơ bản / Đang diễn ra" và hộp "Khu vực phân công: Agent B" bằng dữ liệu thật. Hiển thị mục tiêu, chỉ số mới nhất kèm ngày, hoạt động gần đây, tổng hợp đơn giản. **Đánh dấu rõ dữ liệu còn thiếu** (VD: "Chưa có cân nặng"), không suy ra 0.
5. Lỗi lưu: giữ nguyên nội dung form, hiện thông báo tiếng Việt. Khóa nút trong lúc đang lưu.
6. Không suy luận y khoa, không tạo điểm sức khỏe tổng hợp.

## 6. Kiểm tra B cần báo lại

- Tạo/sửa hồ sơ, mục tiêu, chỉ số; trạng thái thiếu dữ liệu; lỗi lưu giữ form; giao diện 375px.
- Tài khoản B không đọc/sửa được dữ liệu của A qua action (có thể thêm test PGlite theo mẫu `rls-pglite.test.ts`).
- `npm run test`, `npx tsc --noEmit`, `npm run build`.
- Ghi rõ phần chưa thử với Supabase thật.

---

## Prompt giao B (dán nguyên văn)

> Đọc PLAN_MVP.md, hướng dẫn repo và mã hiện có trước khi sửa. Dùng TypeScript, giao diện tiếng Việt, ưu tiên điện thoại. MVP tập trung hồ sơ, nhật ký và người dùng tương tác AI; không xây chức năng HLV, chia sẻ QR, Strava, dinh dưỡng, thanh toán hoặc video. Nội dung và quy tắc demo phải được gắn nhãn, không khẳng định đã kiểm chứng. Không dùng dữ liệu thật trong fixture/log. Không tự động chẩn đoán, kết luận hồi phục, thay đổi tải hoặc sửa hồ sơ bằng AI. Không commit/deploy hay gửi dữ liệu ra dịch vụ ngoài nếu chưa được giao; không ghi bí mật vào mã. Thiếu credential thì hoàn thành phần độc lập và báo rõ. Chạy kiểm tra phù hợp; bàn giao hành vi, tệp sửa, lệnh và kết quả, phụ thuộc, giới hạn. Không ghi đè thay đổi người khác.
>
> Bạn là agent B. Đọc BAN_GIAO_A_SANG_B.md và README.md mục 3–5. Xây tạo/sửa hồ sơ và mục tiêu; chỉ yêu cầu thông tin cần thiết, chiều cao/cân nặng tùy chọn lưu theo ngày/nguồn. Trang tổng quan hiển thị mục tiêu, quan sát và hoạt động qua hợp đồng `@/contracts`; đánh dấu thiếu, nguồn và thời gian. Lưu đúng tài khoản qua `requireAuthenticatedUser()` + `createServerSupabaseClient()`; khi lỗi giữ form. Không suy luận y khoa hoặc tạo điểm sức khỏe. Chỉ sửa các tệp ở mục 2 của bản bàn giao, không đổi schema/auth/contracts; cần thay đổi thì đề xuất cho A. Kiểm tra tạo/sửa, thiếu dữ liệu, lỗi, điện thoại, và báo lại theo mục 6.
