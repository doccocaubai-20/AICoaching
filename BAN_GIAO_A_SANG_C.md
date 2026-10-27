# Bàn giao A → C (Nhật ký hoạt động)

Cập nhật 27/10/2026. Nền A và phần B (hồ sơ, dashboard) đã xong và đã được rà soát. C xây trang nhật ký hoạt động.

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Schema + RLS | 3 migration trong `supabase/migrations/` |
| RLS chạy trên Postgres (PGlite) | Đã chạy (`src/tests/rls-pglite.test.ts`) |
| RLS trên Supabase thật | **Chưa chạy**: chưa có Supabase local/Cloud |
| Dashboard (B) | Đã đọc `activities` để hiển thị thống kê 7 ngày và hoạt động gần đây |
| `/activities` | Mới là khung tĩnh, có hộp "Phụ trách bởi Agent C" và nút "Thêm" bị khóa. C thay toàn bộ trang này |
| `npm run test` / `npx tsc --noEmit` / `npm run build` | 59/59 qua / không lỗi / thành công |

## 2. Tệp C sở hữu

- `src/app/activities/**`: trang nhật ký, server actions của C.
- `src/components/activities/**`: tạo mới khi cần.
- `src/tests/agent-c-*.test.ts`.

**Chỉ đọc, không sửa:** `src/components/dashboard/date-utils.ts`. Dùng lại `formatDateVN`, `getTodayVNDateString`, `formatSourceLabel` trong tệp này.

**Không sửa:** `supabase/**`, `src/contracts/**`, `src/lib/**`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/(auth)/**`, và các tệp của B (`src/app/profile/**`, `src/app/dashboard/**`, `src/components/profile/**`, `src/components/dashboard/**`). Cần đổi schema hoặc contract thì ghi đề xuất cho A trong báo cáo.

## 3. Dữ liệu: bảng `activities`

Import từ `@/contracts`: `ActivityEntity`, `CreateActivityInput`, `UpdateActivityInput`, `validateActivityInput`, `newIdempotencyKey`, `IDEMPOTENCY_CONFLICT_TARGET`.

| Trường | Ghi chú |
|---|---|
| `activity_type` | `calisthenics`, `running`, `badminton`, `walking`, `other` |
| `is_planned` | `true` là lịch dự kiến, `false` là đã tập thật. Phải hiển thị khác nhau rõ ràng |
| `start_at` | `timestamptz`, gửi lên dạng ISO **có múi giờ** (xem mục 4) |
| `duration_minutes` | Số nguyên > 0, bắt buộc |
| `fatigue_level` | 1–10, **tùy chọn**. Không nhập thì gửi `null`, không gửi 0 |
| `notes` | Tùy chọn. Đây là dữ liệu không đáng tin (agent E sẽ đưa vào AI); chỉ hiển thị dạng text, không render HTML |
| `source` | Nhập tay dùng `manual_entry` |
| `idempotency_key` | **Bắt buộc**, duy nhất theo `(user_id, idempotency_key)` |

Database đã tự lo hai việc, C **không** tự làm lại:

- Sửa hoặc xóa một hoạt động sẽ tự đổi các `review_suggestions` đang tham chiếu nó sang `outdated`, nhờ trigger.
- Thống kê trên dashboard được tính lúc đọc. C chỉ cần gọi `revalidatePath('/activities')` và `revalidatePath('/dashboard')` sau khi thêm, sửa hoặc xóa.

## 4. Cách làm bắt buộc

**Đọc/ghi**
- Dùng Server Action với `requireAuthenticatedUser()` và `createServerSupabaseClient()`. Lấy `user_id` từ phiên, **không** lấy từ form.
- Sửa/xóa luôn lọc theo `.eq('id', id).eq('user_id', user.id)`.
- **Không** dùng `createAdminSupabaseClient()`.

**Chống lưu trùng**
- Sinh `newIdempotencyKey()` **một lần khi mở form thêm mới**, giữ trong state.
- Lưu bằng:
  ```ts
  supabase.from('activities').upsert(row, { onConflict: IDEMPOTENCY_CONFLICT_TARGET, ignoreDuplicates: true })
  ```
- Bấm lưu lặp hoặc thử lại sau lỗi mạng: gửi **lại đúng khóa cũ**. Upsert trả về không có dòng mới vì bị trùng: coi là đã lưu thành công.
- Chỉ sinh khóa mới khi mở form thêm hoạt động tiếp theo.
- Khi sửa hoạt động: **không** đổi `idempotency_key`.

**Thời gian**
- `<input type="datetime-local">` trả về giờ địa phương **không có múi giờ**. Nếu đưa chuỗi này lên server rồi gọi `new Date(...)`, giờ sẽ bị hiểu theo múi giờ của server (thường là UTC), lệch 7 tiếng.
- Đổi sang ISO **ngay ở trình duyệt**: `new Date(localValue).toISOString()`, rồi mới gửi lên server.
- Khi sửa, điền lại giá trị vào input theo giờ Việt Nam.
- Mọi chỗ hiển thị ngày giờ dùng `formatDateVN(value, { hour: '2-digit', minute: '2-digit' })`.

**Lỗi và dữ liệu thiếu** (rút kinh nghiệm từ B)
- Kiểm tra `error` của từng truy vấn. Tải lỗi thì hiện "Không tải được nhật ký, thử lại sau", **không** hiện trạng thái rỗng.
- Form sửa mà chưa tải được bản ghi gốc thì **khóa form**, để không ghi đè dữ liệu thật bằng giá trị mặc định.
- Lưu lỗi thì giữ nguyên nội dung form và hiện thông báo tiếng Việt. Khóa nút trong lúc đang lưu.
- Trạng thái rỗng ghi "Chưa ghi hoạt động nào", **không** ghi "Bạn chưa tập". Thiếu dữ liệu không có nghĩa là không tập.
- Thiếu cấu hình Supabase: hiện `CredentialStatusBanner`, khóa nút thêm/sửa/xóa, không giả lập dữ liệu.

## 5. Việc của C (theo PLAN_MVP.md và PROMPT_AGENT_MVP.md)

1. **Danh sách** hoạt động, mới nhất trước. Lọc theo loại môn (các nút lọc đã có sẵn trong khung) và theo "Đã tập" / "Lịch dự kiến". Mỗi dòng hiển thị:
   - loại môn, ngày giờ, thời lượng;
   - mức mệt nếu có;
   - ghi chú nếu có;
   - nhãn "Đã tập" hoặc "Lịch dự kiến";
   - nguồn, qua `formatSourceLabel`.
2. **Thêm** hoạt động:
   - Bắt buộc: loại, ngày giờ, thời lượng.
   - Tùy chọn: mức mệt, ghi chú.
   - Có công tắc "Đây là lịch dự kiến".
3. **Sửa** hoạt động: mở form điền sẵn. Một lịch dự kiến có thể được đánh dấu "Đã tập", tức là đổi `is_planned` sang `false`.
4. **Xóa** hoạt động, có hỏi xác nhận.
5. **Validate** bằng `validateActivityInput`. Trong action thêm giới hạn hợp lý cho thời lượng, ví dụ không quá 1440 phút, mà không sửa contract.
6. **Giao diện** tiếng Việt, khung 375px, nút đủ lớn để bấm.
7. **Không** suy luận phục hồi, không chấm điểm tải tập, không tự đổi lịch.

## 6. Kiểm tra C cần báo lại

- **PGlite** (theo mẫu `rls-pglite.test.ts`, đọc **tất cả** migration theo thứ tự tên):
  - upsert lặp cùng khóa vẫn chỉ ra 1 dòng;
  - sửa và xóa của A không tác động được bản ghi của B;
  - sửa hoặc xóa đánh dấu gợi ý thành `outdated`.
- **Hàm thuần** (đặt trong `src/components/activities/`), test gọi **đúng hàm mà component dùng**, không chép lại logic vào test:
  - đổi giờ địa phương sang ISO;
  - lọc danh sách;
  - kiểm tra thời lượng.
- Thử bằng tay ở khung 375px: thêm, bấm lưu hai lần, sửa, xóa, lỗi lưu giữ form, trạng thái rỗng, chưa cấu hình Supabase.
- Chạy `npm run test`, `npx tsc --noEmit`, `npm run build`, báo kết quả thực tế.
- Ghi báo cáo vào `BAN_GIAO_C.md`:
  - tệp đã sửa;
  - hành vi;
  - lệnh và kết quả;
  - phần chưa thử với Supabase thật;
  - đề xuất gửi A.

---

## Prompt giao C (dán nguyên văn)

> Đọc PLAN_MVP.md, hướng dẫn repo và mã hiện có trước khi sửa. Dùng TypeScript, giao diện tiếng Việt, ưu tiên điện thoại. MVP tập trung hồ sơ, nhật ký và người dùng tương tác AI; không xây chức năng HLV, chia sẻ QR, Strava, dinh dưỡng, thanh toán hoặc video. Nội dung và quy tắc demo phải được gắn nhãn, không khẳng định đã kiểm chứng. Không dùng dữ liệu thật trong fixture/log. Không tự động chẩn đoán, kết luận hồi phục, thay đổi tải hoặc sửa hồ sơ bằng AI. Không commit/deploy hay gửi dữ liệu ra dịch vụ ngoài nếu chưa được giao; không ghi bí mật vào mã. Thiếu credential thì hoàn thành phần độc lập và báo rõ. Chạy kiểm tra phù hợp; bàn giao hành vi, tệp sửa, lệnh và kết quả, phụ thuộc, giới hạn. Không ghi đè thay đổi người khác.
>
> Bạn là agent C. Đọc BAN_GIAO_A_SANG_C.md và README.md mục 3–5. Xây thêm/sửa/xóa và danh sách hoạt động tự nhập: calisthenics, chạy, cầu lông, đi bộ, khác; ngày giờ, thời lượng, mức mệt và ghi chú tùy chọn. Phân biệt kế hoạch với thực tế; không coi thiếu dữ liệu là không tập. Sửa/xóa phải cập nhật tổng quan (revalidatePath) — việc đánh dấu gợi ý cũ đã có trigger database lo. Chống lưu trùng bằng idempotency_key theo mục 4 của bản bàn giao. Xử lý thời gian theo mục 4: đổi sang ISO ở trình duyệt, hiển thị theo giờ Việt Nam. UI tiếng Việt, trạng thái rỗng/lỗi, hỗ trợ điện thoại. Chỉ sửa các tệp ở mục 2; cần đổi schema/contract thì đề xuất cho A. Kiểm tra quyền sở hữu, sửa/xóa, lưu lặp và dữ liệu sai theo mục 6, rồi ghi báo cáo vào BAN_GIAO_C.md.
