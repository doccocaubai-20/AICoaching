# CalisCoaching MVP — Nền tảng Hồ sơ Sức khỏe & Vận động Cá nhân

Dự án MVP web ưu tiên giao diện điện thoại (mobile-first), sử dụng **Next.js (TypeScript)**, **Supabase Auth & Postgres (RLS)**, và **Tailwind CSS**.

---

## 1. Mục tiêu & Ranh giới MVP

### 🎯 Trọng tâm MVP:
1. **Hồ sơ & Mục tiêu cá nhân (Agent B):** Lưu thông tin kinh nghiệm, lịch rảnh, dụng cụ có sẵn, chỉ số tự khai (chiều cao, cân nặng theo ngày & nguồn). Không yêu cầu bệnh án y tế.
2. **Nhật ký đa hoạt động (Agent C):** Ghi chép calisthenics, chạy bộ, cầu lông, đi bộ hoặc khác; thời lượng, mức mệt tự đánh giá (1-10) và ghi chú; phân biệt rõ lịch dự kiến và hoạt động thực tế.
3. **Bài tập calisthenics minh họa (Agent D):** Buổi tập mẫu để trải nghiệm ghi kết quả vào hồ sơ; cơ chế chống ghi trùng (idempotency key); quy tắc xem lại lịch hoạt động gần nhau.
4. **Tương tác AI theo hồ sơ (Agent E):** Tóm tắt hồ sơ có trích dẫn nguồn và khoảng thời gian; hỏi đáp theo hồ sơ; xin đồng ý trước khi chia sẻ dữ liệu và hỗ trợ rút lại đồng ý; tự động fallback sang bản mẫu có nhãn "Không dùng AI" khi thiếu cấu hình hoặc lỗi.

### 🚫 Ranh giới nghiêm ngặt (KHÔNG xây dựng trong MVP):
- **KHÔNG** xây chức năng Huấn luyện viên (HLV), kết nối hay phản hồi HLV.
- **KHÔNG** chia sẻ mã QR, không chia sẻ công khai dữ liệu cá nhân giữa người dùng.
- **KHÔNG** tích hợp Strava hay thiết bị đeo (wearable).
- **KHÔNG** tính toán dinh dưỡng, calo chi tiết.
- **KHÔNG** tích hợp thanh toán hay phân tích video bằng AI.
- **KHÔNG** tự động chẩn đoán y khoa, không kết luận trạng thái hồi phục, không tự động thay đổi tải tập hay sửa hồ sơ người dùng.
- **KHÔNG** sử dụng dữ liệu thật trong fixture, mã nguồn, log hoặc debug.

---

## 2. Yêu cầu hệ thống & Cài đặt cục bộ (Local Setup)

### Yêu cầu tiên quyết:
- **Node.js**: >= 18.18 (khuyến nghị Node 20 LTS hoặc 22/24)
- **npm**: >= 9.x
- **Supabase CLI** (tùy chọn nếu chạy Supabase cục bộ) hoặc tài khoản **Supabase Cloud**.

### Các bước khởi chạy dự án:

#### Bước 1: Sao chép tệp biến môi trường
```bash
cp .env.example .env.local
```
Mở `.env.local` và điền thông tin Supabase:
- `NEXT_PUBLIC_SUPABASE_URL`: URL máy chủ Supabase (VD: `http://127.0.0.1:54321` hoặc URL Supabase Cloud).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Khóa ẩn danh (Anon public key).
- `SUPABASE_SERVICE_ROLE_KEY`: Khóa quản trị Server (chỉ dùng ở server, không lộ ra client).

> [!NOTE]
> Khi chưa cấu hình `.env.local`, hệ thống vẫn khởi chạy an toàn ở chế độ kiểm tra độc lập (Standalone Mode). Giao diện sẽ hiển thị biểu ngữ cảnh báo rõ ràng và vô hiệu hóa các nút ghi dữ liệu trực tiếp, tuyệt đối không giả lập đăng nhập hoặc bỏ qua bảo mật.

#### Bước 2: Chạy kiểm thử tự động
```bash
npm run test
```
Kiểm tra hợp đồng dữ liệu TypeScript, bộ kiểm soát quyền ở Server, và **chạy migration + RLS trên Postgres thật** bằng PGlite (`src/tests/rls-pglite.test.ts`, không cần Docker hay Supabase).

> `npm run lint` chưa dùng được: dự án chưa cài/cấu hình ESLint.

#### Bước 3: Khởi chạy máy chủ phát triển
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

#### Bước 4: Build bản production
```bash
npm run build
```

---

## 3. Cơ sở dữ liệu, Migration & Kiểm tra quyền Row Level Security (RLS)

Tất cả bảng trong cơ sở dữ liệu đều được thiết kế theo nguyên tắc: **Mỗi người dùng chỉ có quyền đọc/ghi dữ liệu của chính mình** (`auth.uid() = user_id`). Tuyệt đối không có bảng quan hệ chia sẻ cho HLV hay bên thứ ba.

### Danh sách 12 bảng trong MVP:
1. `public.profiles`: Hồ sơ người dùng (kinh nghiệm, lịch rảnh, dụng cụ).
2. `public.goals`: Mục tiêu rèn luyện cá nhân.
3. `public.observations`: Chỉ số tự quan sát / tự khai (cân nặng, chiều cao; không tạo điểm sức khỏe tổng hợp).
4. `public.activities`: Nhật ký các hoạt động (calisthenics, chạy, cầu lông, đi bộ; phân biệt thực tế vs kế hoạch).
5. `public.programs`: Giáo trình bài tập (gắn nhãn `is_demo = true`).
6. `public.sessions`: Chi tiết các buổi tập trong giáo trình.
7. `public.session_results`: Kết quả tự khai sau buổi tập (có ràng buộc `idempotency_key` chống ghi trùng).
8. `public.review_suggestions`: Gợi ý xem lại lịch (quy tắc demo tĩnh, không tự đổi tải tập).
9. `public.ai_consents`: Quản lý sự đồng ý chia sẻ dữ liệu với AI (phiên bản, phạm vi, trạng thái rút lại).
10. `public.ai_summaries`: Ảnh chụp bản tóm tắt hồ sơ do AI hoặc template mẫu tạo.
11. `public.ai_conversations`: Phiên hội thoại hỏi đáp theo hồ sơ.
12. `public.ai_messages`: Tin nhắn hỏi đáp có lưu nguồn tham chiếu cụ thể.

### Áp dụng migration vào Supabase:
- `supabase/migrations/20261027000001_mvp_schema_and_rls.sql`: schema và RLS ban đầu.
- `supabase/migrations/20261027000002_a_fixes_ownership_idempotency.sql`: tự tạo hồ sơ khi đăng ký, chống ghi trùng, bảng AI chỉ ghi từ server, kiểm chủ sở hữu bản ghi cha, đánh dấu gợi ý cũ, sửa mặc định thời gian.
- `supabase/migrations/20261027000003_goal_dates_check.sql`: ngày kết thúc mục tiêu không sớm hơn ngày bắt đầu (khớp `validateGoalDates` trong contract).
- `supabase/migrations/20261027000004_activity_duration_review_dedupe.sql`: hoạt động tối đa 1440 phút; chặn trùng gợi ý xem lại lịch còn hiệu lực (cùng user, phiên bản quy tắc, bộ hoạt động đã sắp xếp).
- Dữ liệu bài tập minh họa: `supabase/seed_demo.sql`

Repo chưa có `supabase/config.toml`. Lần đầu dùng Supabase CLI:
```bash
npx supabase init
```
Sau đó trong `supabase/config.toml` đặt `[db.seed]` → `sql_paths = ["./seed_demo.sql"]`, rồi:
```bash
npx supabase start
npx supabase db reset
```
Với Supabase Cloud: chạy lần lượt các tệp migration theo thứ tự tên rồi `seed_demo.sql` trong SQL Editor.

### Kiểm tra bảo mật RLS giữa các tài khoản:
Tệp kịch bản kiểm thử: `supabase/tests/rls_ownership_test.sql`
Kịch bản thực hiện:
1. Tạo 2 tài khoản kiểm thử độc lập (User A và User B).
2. Giả lập phiên đăng nhập dưới quyền User A: Tạo hồ sơ, hoạt động, mục tiêu và đọc dữ liệu cá nhân thành công.
3. Chuyển ngữ cảnh sang User B: Xác nhận User B đọc được `COUNT = 0` trên dữ liệu của User A.
4. User B cố ý UPDATE hoặc DELETE bản ghi của User A: Xác nhận số dòng ảnh hưởng bằng 0 (`rows_affected = 0`).
5. Chuyển sang Anonymous: Xác nhận chặn hoàn toàn truy cập vào bảng dữ liệu cá nhân.

> [!IMPORTANT]
> **Điều kiện kiểm thử:**
> - **Đã chạy:** `src/tests/rls-pglite.test.ts` áp dụng cả hai migration và seed lên Postgres (PGlite) với schema `auth` dựng lại tối thiểu (auth.users, auth.uid(), role anon/authenticated/service_role). Kiểm: cô lập đọc/sửa/xóa, chặn chèn mạo danh, chống ghi trùng, bản ghi con cùng chủ, bảng AI chỉ ghi từ server, đánh dấu gợi ý cũ. `rls_ownership_test.sql` cũng chạy qua trên cùng môi trường này.
> - **Chưa chạy:** trên Supabase thật (local CLI hoặc Cloud). Cần chạy `rls_ownership_test.sql` ở đó trước pilot.
> - `src/tests/rls-rules.test.ts` chỉ dò văn bản SQL, không phải kiểm chứng RLS.

---

## 4. Công bố Hợp đồng Dữ liệu (Contracts) cho các Agent khác

Tất cả kiểu dữ liệu và hợp đồng được xuất tập trung tại `@/contracts` (`src/contracts/index.ts`):

```ts
import {
  Database,
  ProfileEntity,
  validateProfileInput,
  GoalEntity,
  validateGoalInput,
  ObservationEntity,
  validateObservationInput,
  ActivityEntity,
  validateActivityInput,
  ProgramEntity,
  SessionEntity,
  SessionResultEntity,
  ReviewSuggestionEntity,
  AIConsentEntity,
  AISummaryEntity,
  AIConversationEntity,
  AIMessageEntity
} from '@/contracts';
```

### Bộ kiểm soát quyền ở Server (`@/lib/server/auth-guard`):
- `getAuthenticatedUser()`: Lấy thông tin user hiện tại hoặc trả về trạng thái thiếu cấu hình.
- `requireAuthenticatedUser()`: Bắt buộc phiên đăng nhập, ném `UnauthorizedError` nếu chưa đăng nhập.
- `assertResourceOwnership(resourceUserId, authenticatedUserId)`: Kiểm tra quyền sở hữu cấp server, ném `ForbiddenOwnershipError` nếu phát hiện can thiệp dữ liệu chéo.

### Phiên đăng nhập
- `src/middleware.ts` làm mới phiên Supabase mỗi request và chuyển `/dashboard`, `/profile`, `/activities`, `/programs`, `/ai` về `/login` khi chưa đăng nhập. Thiếu cấu hình Supabase thì không chặn; trang hiển thị banner thiếu credential.
- Đăng xuất: form `POST /auth/signout` (đã có trên header).
- Hồ sơ được tạo tự động ở database khi có tài khoản mới (trigger `handle_new_user`, đọc `display_name`, `experience_level` từ metadata đăng ký). Không insert `profiles` từ client lúc đăng ký.

### Chống ghi trùng (`activities`, `session_results`)
`idempotency_key` là bắt buộc, duy nhất theo `(user_id, idempotency_key)`. Sinh bằng `newIdempotencyKey()` một lần khi mở form, rồi lưu:
```ts
supabase.from('activities').upsert(row, { onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true });
```

### Bảng AI (`ai_summaries`, `ai_messages`)
Client chỉ đọc và xóa. Ghi bằng `createAdminSupabaseClient()` (`@/lib/supabase/admin`, service role, bỏ qua RLS) **chỉ ở server**, sau `requireAuthenticatedUser()`, và luôn đặt `user_id` từ phiên. `ai_messages` có khóa ngoại kép `(conversation_id, user_id)` nên không gắn được vào hội thoại của người khác.

### Gợi ý xem lại lịch
Sửa hoặc xóa một hoạt động tự đổi các `review_suggestions` đang tham chiếu nó (trạng thái `pending`/`acknowledged`) thành `outdated` (trigger database).

---

## 5. Quy trình Đề xuất Thay đổi Schema (Dành cho Agent B, C, D, E)

Để bảo đảm tính toàn vẹn và nhất quán của cơ sở dữ liệu:
1. **Agent B, C, D, E tuyệt đối KHÔNG tự ý chỉnh sửa** tệp migration `supabase/migrations/20261027000001_mvp_schema_and_rls.sql`.
2. Khi cần bổ sung cột, bảng hoặc chỉ mục:
   - Gửi yêu cầu đề xuất cho **Người phụ trách A**.
   - Đề xuất phải nêu rõ: Tên bảng, kiểu dữ liệu, lý do, chính sách RLS tương ứng, và cam kết không phá vỡ ranh giới MVP (không thêm HLV, chia sẻ dữ liệu...).
   - Agent A sẽ tạo tệp migration tiếp theo (VD: `20261027000002_...sql`), cập nhật `src/contracts/database.types.ts` và thông báo cho các bên liên quan.
