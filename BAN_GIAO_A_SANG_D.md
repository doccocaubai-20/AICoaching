# Bàn giao A → D (Calisthenics minh họa và xem lại lịch)

Cập nhật 27/10/2026. Nền A, hồ sơ/dashboard (B) và nhật ký (C) đã xong và đã được rà soát. D xây trang buổi tập calisthenics minh họa. Nếu còn thời gian, D làm thêm quy tắc xem lại lịch (P1).

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Schema + RLS | 4 migration trong `supabase/migrations/` |
| Dữ liệu mẫu | `supabase/seed_demo.sql`: 1 chương trình hệ thống, 2 buổi tập (`user_id IS NULL`, `is_demo = true`, `status = 'demo_illustration'`) |
| RLS chạy trên Postgres (PGlite) | Đã chạy (`src/tests/rls-pglite.test.ts`) |
| RLS trên Supabase thật | **Chưa chạy** |
| `/programs` | Còn là khung tĩnh: bài tập viết cứng trong mã, có hộp "Phụ trách bởi Agent D". D thay toàn bộ trang này |
| `npm run test` / `npx tsc --noEmit` / `npm run build` | 74/74 qua / không lỗi / thành công |

## 2. Tệp D sở hữu

- `src/app/programs/**`: trang buổi tập, server actions của D.
- `src/components/programs/**`, `src/components/review/**`: tạo mới khi cần.
- `src/tests/agent-d-*.test.ts`.

**Chỉ đọc, không sửa:**
- `src/components/dashboard/date-utils.ts`: dùng `formatDateVN`, `formatSourceLabel`.
- `src/components/activities/activity-utils.ts`: dùng `localDatetimeToIso`, `isoToVNDatetimeLocal`, `ACTIVITY_TYPE_LABELS`.

**Không sửa:**
- `supabase/**`, `src/contracts/**`, `src/lib/**`, middleware, layout, `(auth)`.
- Các tệp của B và C, kể cả `src/app/activities/**`.

Cần đổi schema hoặc contract thì ghi đề xuất cho A.

## 3. Dữ liệu D dùng

Import từ `@/contracts`:

- **Chương trình và buổi tập:** `ProgramEntity`, `SessionEntity`, `ExerciseItem`, `RecordSessionResultInput`, `SessionResultEntity`.
- **Gợi ý xem lại lịch:** `ReviewSuggestionEntity`.
- **Chống ghi trùng:** `newIdempotencyKey`, `IDEMPOTENCY_CONFLICT_TARGET`.
- **Kiểm tra hoạt động:** `validateActivityInput`, `MAX_ACTIVITY_DURATION_MINUTES`.

| Bảng | D được làm gì |
|---|---|
| `programs`, `sessions` | **Đọc**. Bản ghi hệ thống có `user_id IS NULL`, ai cũng đọc được. D **không** tạo chương trình mới trong MVP |
| `session_results` | **Ghi** kết quả tự khai. Chỉ ghi được cho buổi tập hệ thống hoặc buổi tập của chính mình (RLS). `idempotency_key` bắt buộc, duy nhất theo `(user_id, idempotency_key)` |
| `activities` | **Ghi** một hoạt động `calisthenics` với `source = 'session_sync'` cho mỗi kết quả, để nhật ký, dashboard và AI thấy buổi tập ("hồ sơ được cập nhật") |
| `review_suggestions` | **Ghi/đọc/đổi trạng thái** (P1). Có unique index một phần, chặn trùng gợi ý còn hiệu lực (mục 5) |

`exercises` trong `sessions` là JSON dạng `ExerciseItem[]`: `name`, `sets`, `target_reps`, `rest_seconds`, `note`. Phải kiểm tra lại dữ liệu khi đọc, không tin tuyệt đối vào kiểu khai báo.

## 4. Ghi kết quả buổi tập (P0)

**Luồng:** chọn buổi tập → xem danh sách động tác → nhập kết quả → lưu.

- Kết quả gồm: số hiệp và số lần thực tế cho từng động tác, mức gắng sức 1–10, ghi chú (tất cả **tùy chọn**), thời điểm, thời lượng.
- Động tác bỏ trống thì **không** ghi 0, mà bỏ khỏi `completed_exercises`.

**Chống ghi trùng:**
- Sinh `newIdempotencyKey()` **một lần khi mở form ghi kết quả**.
- Dùng **cùng một khóa** cho cả `session_results` và `activities`. Hai bảng có ràng buộc unique riêng nên không xung đột, và khi thử lại thì cả hai đều tự bỏ qua bản đã có.
- Trong một Server Action:
  1. `requireAuthenticatedUser()` và `createServerSupabaseClient()`, lấy `user_id` từ phiên.
  2. Upsert `session_results` với `{ onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true }`.
  3. Upsert `activities` cũng bằng cách đó, với `activity_type: 'calisthenics'`, `source: 'session_sync'`, `is_planned: false`, `fatigue_level` lấy từ mức gắng sức (`null` nếu bỏ trống), `notes: 'Buổi tập minh họa: <tên buổi>'`.
  4. Nếu bước 3 lỗi sau khi bước 2 đã thành công: báo lỗi và giữ form. Bấm lưu lại với cùng khóa sẽ chỉ bổ sung phần còn thiếu.
  5. Gọi `revalidatePath('/programs')`, `revalidatePath('/activities')` và `revalidatePath('/dashboard')`.
- **Giới hạn đã biết:** chưa có cột liên kết `session_results` với `activities`. Hai bản ghi chỉ nối với nhau qua cùng `idempotency_key`. Xóa hoạt động bên nhật ký **không** xóa kết quả buổi tập. Nêu điều này trong báo cáo. Nếu cần liên kết thật thì đề xuất cho A.

**Thời gian:** form nhập giờ theo giờ Việt Nam qua `localDatetimeToIso`. Thời lượng phải nằm trong 1–`MAX_ACTIVITY_DURATION_MINUTES` phút.

**Hiển thị lịch sử:** danh sách kết quả đã ghi của chính người dùng, mới nhất trước, ngày giờ theo `formatDateVN`.

## 5. Quy tắc xem lại lịch (P1, nếu còn thời gian)

Viết quy tắc dạng **hàm thuần TypeScript** trong `src/components/review/`, ví dụ `evaluateScheduleReview(activities, now)`:

- **Đầu vào:** danh sách hoạt động của người dùng.
- **Đầu ra:**
  - `status`: `'needs_review'`, `'insufficient_data'` hoặc `'no_flag'`;
  - `reason`: tiếng Việt;
  - `reference_activity_ids`: **sắp xếp tăng dần**;
  - `rule_version`, ví dụ `'rule-demo-v1.0'`;
  - `is_demo: true`.
- **Quy tắc minh họa:** một buổi cầu lông và một buổi calisthenics thực tế cách nhau dưới một ngưỡng giờ (ngưỡng demo, ghi rõ trong mã) thì gợi ý "xem lại lịch". **Không** kết luận phục hồi, **không** tự đổi lịch hay tải tập.
- **Thiếu dữ liệu:** thiếu trường cần cho quy tắc (ví dụ `fatigue_level` nếu quy tắc dùng đến) thì trả `insufficient_data` với lý do "Chưa đủ thông tin". Không suy ra giá trị.
- **Lưu:** chỉ lưu khi `needs_review`, dạng `status = 'pending'`. Nếu insert bị lỗi trùng (mã `23505`, do index `uq_review_suggestions_active`) thì coi là gợi ý đã tồn tại, không phải lỗi.
- **Gợi ý cũ:** khi hoạt động nguồn bị sửa hoặc xóa, database tự đổi gợi ý sang `outdated`. D **không** tự làm lại việc này. UI hiển thị gợi ý `outdated` kèm nhãn "Dữ liệu nguồn đã thay đổi".
- **Người dùng** có thể đánh dấu gợi ý là `acknowledged` (đã xem) hoặc `dismissed` (bỏ qua).
- **Ngưỡng demo** chỉ dùng trong demo, không đưa vào khuyến nghị cho người thật.

## 6. Nhãn minh họa (bắt buộc)

- Trang buổi tập luôn có cảnh báo: nội dung là minh họa kỹ thuật, chưa được rà soát bởi chuyên gia; không phải giáo án để người thật tập theo.
- Hiển thị `version` và `status` của chương trình (`demo_illustration` → "Minh họa demo"). Không bao giờ hiển thị là "đã kiểm chứng".
- Gợi ý xem lại lịch luôn có nhãn "Quy tắc demo, chưa rà soát chuyên môn" và hiển thị phiên bản quy tắc.

## 7. Cách làm bắt buộc (rút kinh nghiệm từ B, C)

- Kiểm tra `error` của từng truy vấn. Tải lỗi thì hiện thông báo, **không** hiện trạng thái rỗng ("Chưa có buổi tập") bên dưới.
- Tải buổi tập lỗi thì **khóa** form ghi kết quả.
- Lưu lỗi thì giữ form và hiện thông báo tiếng Việt. Khóa nút trong lúc lưu.
- Thiếu cấu hình Supabase: hiện `CredentialStatusBanner`, khóa nút ghi. Nội dung buổi tập phải lấy từ database, **không** viết cứng lại trong mã.
- Hàm thuần (đọc `exercises`, tính dữ liệu kết quả, quy tắc xem lại lịch) đặt trong thư mục của D. Test phải gọi **đúng hàm mà component dùng**.
- Test thời gian phải kiểm **giá trị**, không chỉ kiểm định dạng. Chạy được với `TZ=UTC`.

## 8. Kiểm tra D cần báo lại

- **PGlite** (đọc **tất cả** migration theo thứ tự tên, rồi `seed_demo.sql`):
  - ghi kết quả cho buổi tập mẫu;
  - lưu lặp cùng khóa ra đúng 1 `session_results` và 1 `activities`;
  - B không ghi được kết quả cho buổi tập riêng của A;
  - (P1) gợi ý trùng bị chặn, gợi ý chuyển `outdated` khi hoạt động nguồn bị sửa.
- **Hàm thuần:**
  - đọc `exercises` sai định dạng;
  - bỏ động tác trống;
  - quy tắc với dữ liệu đủ, thiếu, và khi nguồn thay đổi.
- Thử bằng tay ở khung 375px: xem buổi tập, ghi kết quả, bấm lưu hai lần, lỗi giữ form, nhãn minh họa, chưa cấu hình Supabase.
- Chạy `npm run test`, `npx tsc --noEmit`, `npm run build`, báo kết quả thực tế.
- Ghi báo cáo vào `BAN_GIAO_D.md`:
  - tệp đã sửa;
  - hành vi;
  - lệnh và kết quả;
  - giới hạn đã biết;
  - phần chưa thử với Supabase thật;
  - đề xuất gửi A.

---

## Prompt giao D (dán nguyên văn)

> Đọc PLAN_MVP.md, hướng dẫn repo và mã hiện có trước khi sửa. Dùng TypeScript, giao diện tiếng Việt, ưu tiên điện thoại. MVP tập trung hồ sơ, nhật ký và người dùng tương tác AI; không xây chức năng HLV, chia sẻ QR, Strava, dinh dưỡng, thanh toán hoặc video. Nội dung và quy tắc demo phải được gắn nhãn, không khẳng định đã kiểm chứng. Không dùng dữ liệu thật trong fixture/log. Không tự động chẩn đoán, kết luận hồi phục, thay đổi tải hoặc sửa hồ sơ bằng AI. Không commit/deploy hay gửi dữ liệu ra dịch vụ ngoài nếu chưa được giao; không ghi bí mật vào mã. Thiếu credential thì hoàn thành phần độc lập và báo rõ. Chạy kiểm tra phù hợp; bàn giao hành vi, tệp sửa, lệnh và kết quả, phụ thuộc, giới hạn. Không ghi đè thay đổi người khác.
>
> Bạn là agent D. Đọc BAN_GIAO_A_SANG_D.md và README.md mục 3–5. Thay trang `/programs` bằng nội dung calisthenics minh họa đọc từ database (chương trình và buổi tập mẫu trong seed), màn buổi tập và ghi kết quả vào hồ sơ: lưu `session_results` và một hoạt động `calisthenics` nguồn `session_sync`, dùng chung một idempotency key theo mục 4. Nhãn nêu rõ nội dung demo chưa được kiểm chứng, không giới thiệu là giáo án để người thật tập theo (mục 6). Nếu thời gian cho phép, làm quy tắc xem lại lịch dạng hàm thuần TypeScript theo mục 5: trả về trạng thái xem xét, lý do, IDs nguồn đã sắp xếp, phiên bản và nhãn demo; minh họa cầu lông gần buổi calisthenics; trường thiếu trả về chưa đủ thông tin; không tự đổi tải hoặc kết luận sức khỏe; gợi ý cũ do trigger database đánh dấu. Ngưỡng demo không đưa vào khuyến nghị người thật. Chỉ sửa các tệp ở mục 2; cần đổi schema/contract thì đề xuất cho A. Làm theo mục 7 và kiểm tra theo mục 8, rồi ghi báo cáo vào BAN_GIAO_D.md.
