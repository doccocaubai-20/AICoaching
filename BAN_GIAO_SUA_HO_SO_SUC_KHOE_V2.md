# Báo Cáo Bàn Giao: Khắc Phục Toàn Diện 16 Phát Hiện Review Hồ Sơ Sức Khỏe V2 (S1–S5 & E1–E11)

**Dự án:** CalisCoaching  
**Tài liệu yêu cầu:** `C:/Users/admin/Documents/IEC/PROMPT_SUA_HO_SO_SUC_KHOE_V2.md`  
**Đặc tả gốc:** `C:/Users/admin/Documents/IEC/PLAN_HO_SO_SUC_KHOE_V2.md`  
**Báo cáo phát hiện review:** `C:/Users/admin/Documents/IEC/research/REVIEW_HO_SO_SUC_KHOE_V2_bb6d6cb.md`  
**Nhánh Git:** `feature/health-v2-breakthrough-experience`  
**Mốc bắt đầu (HEAD xuất phát):** `5a9291b` (docs: Bo sung bao cao ban giao trai nghiem dot pha & suc khoe V2)  
**Tình trạng hiện tại:** Mã nguồn và migration đã sửa đổi toàn bộ; **chưa commit, push, deploy hoặc chạy migration production** theo đúng yêu cầu kiểm soát.

---

## 1. Mốc Xuất Phát, Bảo Tồn Tính Năng Mới & Danh Sách Tệp Sửa Đổi

### 1.1. Bảo tồn các tính năng mới hơn trong repo
Toàn bộ các tính năng đột phá từ các commit gần nhất (`f3c4276`, `5a9291b`) đều được **giữ nguyên vẹn 100%**:
1. **Live Workout Companion:** Đồng hành tập luyện thời gian thực, đồng hồ đếm ngược hiệp nghỉ và âm thanh Web Audio sống động.
2. **Calisthenics Skill Tree RPG:** Cây kỹ năng thể hình 4 nhánh (Đẩy, Kéo, Core, Handstand) với điểm EXP và danh hiệu vận động viên.
3. **Athlete Passport & QR Code:** Thẻ căn cước thể thao mã hóa chuẩn URL-safe Base64 + HMAC-SHA256, xác thực offline tại `/passport`.

### 1.2. Danh sách tệp tin & migration sửa đổi
- **Migration cơ sở dữ liệu:**
  - `supabase/migrations/20261027000007_health_v2_security_fixes.sql` (Mới: RLS cho `storage.objects`, DB trigger chống cross-owner event, check constraint cho `observations`).
- **Hợp đồng dữ liệu (`src/contracts/`):**
  - `src/contracts/daily-checkin.contract.ts` (Sửa E11: tính cả giấc ngủ 0 phút; giới hạn 7 ngày).
  - `src/contracts/consent.contract.ts` (Sửa E7: thêm scope `daily_checkins` và `blood_pressures`).
  - `src/contracts/health-document.contract.ts` (Sửa E2: xuất hằng số MIME và kích thước file).
- **Thư viện tiện ích & AI (`src/lib/`):**
  - `src/lib/date-utils.ts` (Mới: E5 - helper ngày địa phương thống nhất theo IANA timezone).
  - `src/lib/ai/types.ts` & `src/lib/ai/context.ts` (Sửa E7: tích hợp dữ liệu V2 theo consent chặt chẽ, loại bỏ hoàn toàn dữ liệu y khoa nhạy cảm).
  - `src/lib/server/health-profile-actions.ts` (Sửa S1, S2, S3, S4, E2, E6: upload file thật, kiểm tra quota/magic bytes, ký signed URL, sửa số đo giữ ID/ngày, xóa storage an toàn).
- **Giao diện người dùng (`src/components/` & `src/app/`):**
  - `src/components/health-v2/DailyCheckinTab.tsx` & `QuickCheckinWidget.tsx` (Sửa S5: giữ nguyên `null` khi chưa khai).
  - `src/components/health-v2/VitalsTab.tsx` (Sửa E6: hỗ trợ sửa/ghi bù số đo và huyết áp, chọn ngày và nguồn đo).
  - `src/components/health-v2/EventsAndDocumentsTab.tsx` (Sửa E2: upload file thật, thanh tiến trình, mở/tải về/đổi tên file).
  - `src/components/health-v2/HealthOverviewTab.tsx` (Sửa E4: khóa chặt cửa sổ 7 ngày địa phương).
  - `src/components/health/AISynergyGuardCard.tsx` (Sửa E1: gỡ bỏ Green Light và giảm tải 20–30%, đổi thành đối chiếu thông tin với nhãn Quy tắc cục bộ).
  - `src/app/profile/page.tsx`, `src/app/health/page.tsx`, `HealthProfileContainer.tsx`, `HealthManager.tsx` (Sửa E3: xử lý riêng biệt lỗi tải dữ liệu, không biến lỗi thành hồ sơ trống).
  - `src/components/programs/LiveWorkoutModal.tsx` & `ProgramsManager.tsx` (Sửa E8, E9, E10: giữ modal khi lưu lỗi, đồng bộ contract kết quả bài tập, khóa idempotency key cố định khi retry).
  - `src/app/passport/page.tsx` (TypeScript overload cho Next.js 15 App Router `PageProps`).
- **Bộ kiểm thử tự động (`src/tests/`):**
  - `src/tests/standards-v2-security.test.ts` (Mới: 10 tests kiểm tra Postgres RLS, Trigger chống cross-owner, DB constraints với PGlite).
  - `src/tests/review-v2-findings.test.tsx` (Mới: 10 tests tái hiện và xác minh 10 phát hiện review V2).
  - `src/tests/health-v2-operations.test.ts` (Mới: 11 tests kiểm tra CRUD thực tế, upload file, ký URL, AI consent context, sửa số đo).
  - `src/tests/review-experience-findings.test.tsx` (Mới: 10 tests kiểm tra Live Workout, Skill Tree và Passport).
  - `vitest.config.ts` (Cấu hình timeout 30s chống nghẽn PGlite parallel).

---

## 2. Bảng Đối Chiếu Chi Tiết 16 Phát Hiện Review (S1–S5 & E1–E11)

| Mã | Tên phát hiện | Trạng thái | Giải pháp kỹ thuật đã triển khai | Bằng chứng kiểm thử (Trước → Sau) | Giới hạn còn lại |
|---|---|---|---|---|---|
| **S1** | Storage RLS theo Owner | **Đã sửa & Xác minh** | Thêm migration 7 tạo 4 RLS policies trên `storage.objects` cho bucket `health_documents`, kiểm tra `(storage.foldername(name))[1] = auth.uid()::text`. Server tạo đường dẫn an toàn `[uid]/[uuid].[ext]`. | *Trước:* Thiếu policy storage. *Sau:* `standards-v2-security.test.ts` (S1.1–S1.3) xác minh User A không thể đọc/ghi đè file User B; Anon bị từ chối 100%. | Cần chạy migration 7 trên môi trường Supabase production trước khi mở tính năng. |
| **S2** | Ngăn liên kết tài liệu với event khác owner | **Đã sửa & Xác minh** | Thêm trigger DB `trg_check_health_document_event_owner` trên bảng `health_documents` kiểm tra `health_events.user_id = NEW.user_id`. Bảo vệ ở cả tầng DB và Server Action. Hỗ trợ `ON DELETE SET NULL`. | *Trước:* User A chèn event_id của User B thành công. *Sau:* DB ném ngoại lệ `Cannot link health document to an event owned by another user` (`standards-v2-security.test.ts` S2.1–S2.3). | Không có |
| **S3** | Xóa file có kết quả đúng và retry được | **Đã sửa & Xác minh** | Trong `deleteHealthDocumentAction`, gọi `storage.from('health_documents').remove([doc.storage_path])`. Nếu storage báo lỗi, metadata DB được giữ nguyên, trả về `{ success: false }` để giao diện hiển thị lỗi và cho phép người dùng thử lại. | *Trước:* Metadata bị xóa kể cả khi storage xóa thất bại, mất khả năng retry. *Sau:* `health-v2-operations.test.ts` (S3.1–S3.2) xác nhận metadata giữ nguyên khi storage lỗi. | Trường hợp bucket cloud mất mạng cục bộ phụ thuộc vào retry của client. |
| **S4** | Validation server và DB cho số đo | **Đã sửa & Xác minh** | Thêm check constraint DB `observations_metric_unit_non_empty` và `observations_metric_value_positive`. Trong `addObservationDirectAction`, loại bỏ `any`, xác thực chặt chẽ qua `validateObservationInput`. Giữ tính tương thích với `other`, `body_feel`. | *Trước:* `addObservationDirectAction` nhận `any`, cho phép chèn metric_value ≤ 0 hoặc unit rỗng. *Sau:* DB và Action từ chối số âm/bằng 0 và unit rỗng (`standards-v2-security.test.ts` S4.1–S4.2). | Dải hợp lệ chỉ để phát hiện lỗi nhập liệu, không coi là ngưỡng y khoa an toàn. |
| **S5** | Giữ null là chưa khai trong check-in | **Đã sửa & Xác minh** | Sửa `DailyCheckinTab.tsx` và `QuickCheckinWidget.tsx`: các trường `sleepHours`, `sleepMins`, `sleepQuality`, `energyLevel`, `stressLevel` sử dụng kiểu `number | null`. Chỉ gửi số khi người dùng chủ động nhập/chọn. | *Trước:* Không nhập gì tự động lưu 7.5h và ratings 4/3/2. *Sau:* `review-v2-findings.test.tsx` (Finding 5) xác nhận payload gửi lên có các trường `null`, không bịa số. | Không có |
| **E1** | Bỏ suy diễn sẵn sàng tập & đổi tải từ rule sơ sài | **Đã sửa & Xác minh** | Tái cấu trúc `AISynergyGuardCard.tsx` thành "Đối Chiếu Thông Tin Sức Khỏe & Vận Động" với nhãn "Quy tắc cục bộ". Gỡ bỏ hoàn toàn huy hiệu "Green Light", gỡ bỏ các kết luận tự động giảm tải (20–30%) hoặc chẩn đoán. Khi chưa có dữ liệu hiển thị khung trung tính "Chưa có dữ liệu sinh hoạt hôm nay". | *Trước:* Tự ý kết luận Green Light và đề xuất giảm tải y khoa. *Sau:* `review-v2-findings.test.tsx` (Finding 4) xác nhận không còn chữ Green Light / giảm tải, hiển thị đúng nhãn cục bộ. | Quy tắc cục bộ chỉ mang tính hiển thị tổng hợp thông tin đối chiếu cho người dùng. |
| **E2** | Luồng upload, ký URL và quản lý file thật | **Đã sửa & Xác minh** | Gỡ bỏ `fakePath` và 500KB giả định. Thay bằng `<input type="file">` thật, kiểm tra kích thước (≤ 10MB), quota người dùng (≤ 100MB), kiểm tra magic bytes (PDF, PNG, JPEG) trên server. Tạo signed URL 5 phút qua `getHealthDocumentSignedUrlAction`. Thêm tính năng đổi tên tài liệu thật. | *Trước:* Giả lập path và dung lượng, bấm mở chỉ hiện `alert()`. *Sau:* `health-v2-operations.test.ts` (E2.1–E2.3) và `EventsAndDocumentsTab.tsx` xử lý upload file thật, từ chối file > 10MB hoặc sai magic bytes. | Trên môi trường local không có Supabase Storage daemon thật, kiểm thử dựa trên mock storage contract và byte validation. |
| **E3** | Không biến lỗi tải thành hồ sơ trống | **Đã sửa & Xác minh** | Trên `/profile`, `/health`, `HealthProfileContainer.tsx` và `HealthManager.tsx`, bổ sung mảng `loadErrors`. Khi xảy ra lỗi truy vấn, hiển thị banner cảnh báo kèm nút "Thử lại", đồng thời vô hiệu hóa nút submit hồ sơ để tránh ghi đè dữ liệu rỗng lên DB. | *Trước:* Lỗi tải dẫn đến hiển thị "Không có bệnh / thuốc" và cho phép submit đè hồ sơ trống. *Sau:* `review-v2-findings.test.tsx` (Finding 8) xác nhận hiển thị thông báo lỗi và bảo vệ form. | Không có |
| **E4** | Thống kê đúng cửa sổ 7 ngày địa phương | **Đã sửa & Xác minh** | Cập nhật `HealthOverviewTab.tsx` lọc dữ liệu `dailyCheckins` theo đúng khoảng `[hôm nay - 6 ngày, hôm nay]` theo ngày địa phương trước khi tính. Cập nhật `computeCheckinWeeklyStats` giới hạn tối đa `windowDays = 7` ngày duy nhất. | *Trước:* Truyền cả 30 bản ghi vào helper 7 ngày gây lệch mẫu số. *Sau:* `review-v2-findings.test.tsx` (Finding 2) xác nhận chỉ lấy đúng 7 ngày và tính đúng tỷ lệ. | Không có |
| **E5** | Helper ngày địa phương thống nhất | **Đã sửa & Xác minh** | Tạo `src/lib/date-utils.ts` với các hàm `getLocalDateString`, `getPastLocalDateString`, `get7DayWindow` sử dụng IANA timezone (mặc định `'Asia/Ho_Chi_Minh'`). Thay thế toàn bộ việc cộng 7 giờ thủ công hoặc dùng `toISOString().slice(0, 10)`. | *Trước:* Một số màn cộng cứng 7 giờ, một số dùng UTC ISO slice gây lệch ngày lúc nửa đêm. *Sau:* `health-v2-operations.test.ts` (E5.1–E5.2) kiểm thử thành công qua nửa đêm và nhiều múi giờ khác nhau. | Cần hồ sơ người dùng lưu đúng IANA timezone string nếu ở ngoài múi giờ Việt Nam. |
| **E6** | Sửa/ghi bù số đo và huyết áp giữ nguyên lịch sử | **Đã sửa & Xác minh** | Thêm `updateObservationAction` và `updateBloodPressureAction` trong `health-profile-actions.ts`. Cung cấp ô chọn ngày giờ đo (`observed_at` / `measured_at`) và nguồn đo (`self_reported` / `manual_import`) khi thêm và khi sửa. Thao tác sửa giữ nguyên ID bản ghi. | *Trước:* Muốn sửa sai phải xóa bản ghi tạo mới, mất ID và ngày giờ gốc. *Sau:* `health-v2-operations.test.ts` (E6.1–E6.3) và `VitalsTab.tsx` kiểm thử sửa trực tiếp giữ nguyên ID. | Không có |
| **E7** | Mở rộng AI G4 tuân thủ Consent & Riêng tư | **Đã sửa & Xác minh** | Mở rộng consent enum với `daily_checkins` và `blood_pressures`. Trong `buildAIContext`, chỉ đính kèm sinh hoạt và huyết áp khi người dùng đã cấp quyền tương ứng. Tuyệt đối không gửi bệnh sử, thuốc, dị ứng, tài liệu hoặc ghi chú tự do không tin cậy vào prompt AI. | *Trước:* Chưa có consent cho dữ liệu V2 hoặc nguy cơ lộ thông tin bệnh sử. *Sau:* `health-v2-operations.test.ts` (E7.1–E7.3) xác nhận kiểm soát scope chặt chẽ và không tồn tại trường nhạy cảm trong payload AI. | AI hiện chỉ diễn giải các chỉ số do TypeScript tính toán, không suy diễn y khoa. |
| **E8** | Live Workout lưu lỗi giữ nguyên màn hình | **Đã sửa & Xác minh** | Cập nhật `LiveWorkoutModal.tsx` và `ProgramsManager.tsx`: kiểm tra kết quả trả về từ `recordSessionResultAction`. Nếu `success === false` hoặc mất mạng, modal không đóng, giữ nguyên toàn bộ ghi chú và số rep đã hoàn thành để người dùng bấm thử lại. | *Trước:* Bấm lưu luôn đóng modal bất kể thành công hay thất bại. *Sau:* `review-v2-findings.test.tsx` (Finding 7) xác nhận modal giữ nguyên và hiển thị thông báo lỗi khi server trả về false. | Không có |
| **E9** | Đồng bộ contract kết quả bài tập Live Workout | **Đã sửa & Xác minh** | Cập nhật `LiveWorkoutModal.tsx` đóng gói bài tập theo đúng chuẩn của `cleanCompletedExercises`: `{ exercise_name, actual_sets, actual_reps }`. Ghi nhận số reps người dùng thực hiện thay vì sao chép target_reps. | *Trước:* Gửi `{ name, sets_completed }` khiến cleaner phía server loại bỏ toàn bộ bài tập. *Sau:* `review-v2-findings.test.tsx` (Finding 9) xác nhận các bài tập được cleaner giữ lại đầy đủ. | Không có |
| **E10** | Khóa Idempotency ổn định cho buổi tập | **Đã sửa & Xác minh** | Tạo state `liveIdempotencyKey` trong `ProgramsManager.tsx` ngay khi bắt đầu buổi tập và giữ nguyên qua mọi lượt retry khi lưu thất bại. Chỉ sinh khóa mới khi lưu thành công hoặc mở buổi tập mới. | *Trước:* Mỗi lần retry sinh một khóa ngẫu nhiên mới, có nguy cơ nhân đôi dữ liệu. *Sau:* `review-v2-findings.test.tsx` (Finding 10) xác nhận cùng 1 khóa UUID được tái sử dụng qua các lần retry. | Không có |
| **E11** | Xử lý đúng giấc ngủ 0 phút | **Đã sửa & Xác minh** | Cập nhật hàm thuần `computeCheckinWeeklyStats` trong `daily-checkin.contract.ts`: lọc theo điều kiện `m >= 0` thay vì `m > 0`. Trường hợp thức trắng đêm (0 phút) được tính vào trung bình cộng: 0 phút + 480 phút = 240 phút trên 2 ngày. Các ngày `null` không bị tính thành 0. | *Trước:* `m > 0` bỏ qua giá trị 0 phút khiến trung bình bị sai lệch. *Sau:* `review-v2-findings.test.tsx` (Finding 1) xác nhận trung bình 240 phút trên 2 ngày ghi nhận. | Không có |

---

## 3. Các Luồng Nghiệp Vụ Thực Tế Chạy Được

1. **Luồng Tạo & Quản lý Hồ sơ Nền:**
   - Người dùng đăng nhập → Mở trang Hồ sơ (`/profile`) → Khai báo năm sinh, công việc, múi giờ sinh hoạt.
   - Khi có sự cố kết nối, giao diện hiện thông báo lỗi và nút "Thử lại", khóa nút lưu để ngăn đè hồ sơ trống.
2. **Luồng Đo Đạc Thể Chất & Ghi Bù / Sửa Số Đo:**
   - Nhập cân nặng, vòng eo, nhịp tim nghỉ hoặc huyết áp kèm ngày giờ đo và nguồn đo tùy chọn.
   - Xem bảng lịch sử → Bấm nút "Sửa" trực tiếp → Cập nhật số đo mà vẫn giữ nguyên ID bản ghi và thời điểm đo.
   - Thử nhập giá trị âm hoặc rỗng: Server Action và Postgres constraint từ chối ngay lập tức.
3. **Luồng Check-in Sinh Hoạt Hằng Ngày:**
   - Chọn ngày kiểm tra (hôm nay hoặc các ngày trước đó qua date-picker địa phương).
   - Chỉ điền ghi chú hoặc mức năng lượng, bỏ trống giấc ngủ: hệ thống lưu đúng `null`, không tự điền 7.5h hay ratings mặc định.
   - Khai báo thức trắng đêm (0 phút): hệ thống tính đúng trung bình 240 phút khi kết hợp với ngày ngủ 8 tiếng.
4. **Luồng Quản lý Bệnh Khai, Thuốc & Sự Kiện Khám:**
   - Phân biệt rõ tình trạng đã chẩn đoán vs triệu chứng tự ghi nhận vs chấn thương.
   - Khai báo danh mục thuốc và theo dõi trạng thái Đang dùng / Đã ngừng.
   - Thêm sự kiện khám bệnh và tải lên tệp phiếu khám thật (PDF, PNG, JPG ≤ 10MB).
   - Kiểm tra magic bytes và quota dung lượng 100MB/người dùng; lấy signed URL 5 phút để xem file.
   - Thử xóa file: nếu dịch vụ lưu trữ báo lỗi, metadata được bảo vệ nguyên vẹn để người dùng thử lại.
5. **Luồng Trợ Lý AI V2 Tuân Thủ Riêng Tư:**
   - Người dùng chọn cấp quyền riêng cho "Sinh hoạt hàng ngày" (`daily_checkins`) hoặc "Huyết áp" (`blood_pressures`).
   - AI tóm tắt hoặc trả lời dựa trên số liệu do code tính toán và trích dẫn ID nguồn hợp lệ.
   - Dữ liệu y tế nhạy cảm (bệnh sử, thuốc, dị ứng, tệp khám) tuyệt đối không bao giờ được gửi vào context AI.
   - Khi không cấu hình AI key, hệ thống tự động kích hoạt chế độ Fallback không dùng AI an toàn.
6. **Luồng Tập Luyện Trực Tiếp (Live Workout):**
   - Bắt đầu bài tập → Đồng hồ đếm nghỉ và âm thanh Web Audio hoạt động trơn tru.
   - Khi kết thúc, ghi nhận số reps thực tế và gửi kết quả với khóa idempotency ổn định.
   - Nếu server báo lỗi lưu: Modal giữ nguyên kết quả bài tập để người dùng retry thành công mà không mất dữ liệu.

---

## 4. Kết Quả Kiểm Thử, Biên Dịch & Bản Dựng

### 4.1. Bộ kiểm thử tự động (`npm run test`)
- **Tổng số test suites:** **17/17 test files passed (100%)**
- **Tổng số ca kiểm thử:** **205/205 tests passed (100%)**
- **Thời gian thực thi:** 16.93s
- **Chi tiết các suite chính:**
  - `src/tests/standards-v2-security.test.ts`: **10/10 tests PASS** (Kiểm tra RLS Storage, Trigger chống cross-owner, DB constraints với PGlite).
  - `src/tests/review-v2-findings.test.tsx`: **10/10 tests PASS** (Kiểm tra khắc phục 10 phát hiện review V2).
  - `src/tests/health-v2-operations.test.ts`: **11/11 tests PASS** (Kiểm tra File upload, Signed URL, Sửa số đo, AI context privacy).
  - `src/tests/review-experience-findings.test.tsx`: **10/10 tests PASS** (Kiểm tra Live Workout, Skill Tree RPG, Passport QR).
  - `src/tests/health-profile-v2.test.ts`: **13/13 tests PASS**.
  - `src/tests/agent-f-integration.test.ts`: **14/14 tests PASS**.
  - `src/tests/agent-e-ai.test.ts`: **29/29 tests PASS**.
  - `src/tests/rls-pglite.test.ts`: **26/26 tests PASS**.
  - Các suite Agent B, C, D, contracts và guard: **PASS 100%**.

### 4.2. Kiểm tra kiểu tĩnh (`npx tsc --noEmit`)
- **Kết quả:** **0 errors (Exit code 0)**.
- Đã khắc phục toàn bộ các lỗi liên quan đến PageProps Next.js 15, strict type checking cho `ObservationSource` và `DailyCheckinEntity`.

### 4.3. Bản dựng Production (`npm run build`)
- **Kết quả:** **Compiled successfully in 5.3s (Exit code 0)**.
- Toàn bộ 12 tuyến đường App Router (bao gồm `/profile`, `/health`, `/passport`, `/dashboard`, `/programs`, `/activities`, `/ai`) đều được dựng thành công không có lỗi runtime/build-time.

---

## 5. Hướng Dẫn Triển Khai Migration & Thứ Tự Phát Hành

> [!IMPORTANT]
> Theo đúng chỉ đạo của người dùng, toàn bộ mã nguồn hiện tại đang được giữ ở trạng thái staged/unstaged trong working tree cục bộ, **chưa commit, chưa push lên Git remote và chưa chạy migration trên Supabase production**.

### Thứ tự các bước phát hành khi người dùng phê duyệt:
1. **Kiểm tra trạng thái Git:**
   ```bash
   git status
   ```
2. **Commit và đẩy lên nhánh:**
   ```bash
   git commit -m "fix(health-v2): Khac phuc triet de 16 phat hien review S1-S5 va E1-E11"
   git push origin feature/health-v2-breakthrough-experience
   ```
3. **Áp dụng Migration trên Supabase:**
   - Chạy tệp migration mới: [`supabase/migrations/20261027000007_health_v2_security_fixes.sql`](file:///c:/Users/admin/Documents/CalisCoaching/supabase/migrations/20261027000007_health_v2_security_fixes.sql) thông qua Supabase CLI hoặc SQL Editor của Supabase Console:
     ```bash
     supabase db push
     ```
   - Migration này sẽ:
     - Tạo trigger `trg_check_health_document_event_owner` trên bảng `health_documents`.
     - Thêm check constraints cho `observations` (`observations_metric_unit_non_empty`, `observations_metric_value_positive`).
     - Thiết lập 4 chính sách RLS trên bảng `storage.objects` cho bucket `health_documents` nhằm cô lập tài liệu theo `auth.uid()`.
4. **Cấu hình Bucket Storage:**
   - Đảm bảo bucket `health_documents` trên Supabase Storage được đặt ở chế độ **Private** (không bật public access).
   - Giới hạn kích thước tệp tải lên tối đa là 10MB.
5. **Triển khai ứng dụng (Deploy Vercel):**
   - Tiến hành deploy bản build mới lên hosting Vercel sau khi migration cơ sở dữ liệu đã hoàn tất.
