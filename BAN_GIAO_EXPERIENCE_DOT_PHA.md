# BÁO CÁO BÀN GIAO: BẢN NÂNG CẤP ĐỘT PHÁ TRẢI NGHIỆM & SỨC KHỎE V2
## CALISCOACHING - INTERACTIVE & HEALTH SYNERGY EXPERIENCE

**Nhánh Git:** `feature/health-v2-breakthrough-experience`  
**Ngày cập nhật:** 27/10/2026  
**Trạng thái kiểm thử:** 214/214 tests passed across 20 test suites (100% pass tuần tự)  
**Biên dịch & Build tại lần bàn giao ban đầu:** ghi nhận ở commit trước các sửa lỗi review. Hiện giới hạn Server Actions là 4.5MB để nhận tệp tối đa 4 MiB qua Vercel; xem phần cập nhật sửa lỗi review ở cuối tài liệu.

---

## 1. Bối cảnh & Mục tiêu nhánh phát triển

Bản MVP trước đây tập trung chủ yếu vào độ an toàn và chuẩn mực cơ sở dữ liệu (RLS, schema, validation, tóm tắt AI có trích dẫn), nhưng trải nghiệm người dùng còn thiên về biểu mẫu nhập liệu tĩnh (CRUD forms), dễ gây cảm giác **"nhàm chán, như điền giấy tờ hành chính"**.

Trên nhánh mới `feature/health-v2-breakthrough-experience`, chúng tôi đã xây dựng một **bước nhảy vọt về trải nghiệm người dùng (UX/UI)**, biến CalisCoaching thành một **Trợ lý Vận động & Sức khỏe Tương tác Thời Gian Thực**:

```
      [Hồ Sơ Sức Khỏe Toàn Diện V2 (/health)]
                         ↕ (Đối chiếu an toàn)
[Daily Check-in 10s] ➔ [AI Synergy Health Guard] ➔ [Live Workout Companion]
                                                         ↕ (Tích lũy XP)
                                              [Cây Kỹ Năng RPG (Skill Tree)]
                                                         ↕
                                         [Thẻ Căn Cước Vận Động (/passport)]
```

---

## 2. Chi tiết 5 tính năng ĐỘT PHÁ đã được triển khai

### ⚡ 1. Chế Độ Tập Luyện Trực Tiếp Có Bấm Giờ Nghỉ (Live Workout Companion)
* **Vị trí:** Trang `/programs` -> Nút bấm **"⚡ Tập Live Này"** trên mỗi thẻ buổi tập.
* **Trải nghiệm tương tác:**
  * **Đếm ngược chuẩn bị 3 - 2 - 1:** Có âm thanh Beep báo hiệu vào vị trí.
  * **Giao diện Focus Mode toàn màn hình:** Hiển thị bài tập hiện tại, hiệp đang tập (`Set X / Y`), số reps mục tiêu, nhịp thở và ghi chú form chuẩn.
  * **Đồng hồ bấm giờ tổng (Workout Stopwatch):** Chạy liên tục theo thời gian thực.
  * **Bộ tổng hợp âm thanh Web Audio Synthesizer (`workout-sound.ts`):** 
    * Tiếng Ding trong trẻo khi bấm *"Xong hiệp này 🎯"*.
    * Kích hoạt ngay **Đồng hồ đếm ngược thời gian nghỉ (Rest Timer 60s/90s)** dạng vòng tròn (Circular Progress).
    * Khi đồng hồ nghỉ về 3, 2, 1 -> phát tiếng Beep; về 0 -> phát tiếng chuông reo **Rest Over Alarm** báo vào hiệp tiếp theo.
  * **Kết thúc buổi tập:** Phát nhạc chiến thắng (Fanfare), cho chọn mức mệt RPE (1-10) và yêu cầu người dùng nhập số reps thực tế trước khi lưu.

---

### 🌳 2. Cây Kỹ Năng Calisthenics Nhập Vai RPG (Skill Tree Section)
* **Vị trí:** Tích hợp trực tiếp tại trung tâm trang `/programs`.
* **Cơ chế Gamification:**
  * **Hệ thống Điểm kinh nghiệm (XP):** Người dùng hoàn thành mỗi buổi tập sẽ tích lũy +50 XP.
  * **5 Cấp bậc võ sĩ:** *Tân Thủ (Novice) ➔ Tập Sự (Apprentice) ➔ Chiến Binh (Warrior) ➔ Tinh Anh (Elite) ➔ Bậc Thầy (Master)*.
  * **3 Nhánh kỹ năng tiến trình chuẩn Calisthenics:**
    * **Nhánh Đẩy (Pushing):** Incline Push-up ➔ Standard Push-up ➔ Diamond Push-up ➔ Archer Push-up ➔ Handstand Push-up.
    * **Nhánh Kéo (Pulling):** Dead Hang ➔ Inverted Row ➔ Standard Pull-up ➔ Chest to Bar ➔ Muscle-up.
    * **Nhánh Core & Chân:** Squat/Plank ➔ Hanging Knee Raise ➔ L-Sit ➔ Dragon Flag.
  * **Bảo vệ toàn vẹn dữ liệu:** Khi có lỗi đọc DB (`resultsError`), hệ thống tạm dừng tính toán XP và hiển thị cảnh báo, tuyệt đối không tự ý hiển thị user như một tân thủ trắng điểm.

---

### 🪪 3. Thẻ Căn Cước Vận Động & Mã QR Động (`/passport`)
* **Vị trí:** Route mới `/passport` hoặc truy cập qua nút **"Athlete Passport"** trên Dashboard.
* **Thiết kế Cyberpunk / Hologram sang trọng:**
  * Mã định danh hồ sơ vận động viên: `#CC-[ID]` bền vững theo tài khoản.
  * **Chuỗi ngày kỷ luật (Streak Flame 🔥):** Tính theo chuỗi ngày tập liên tiếp thực tế theo giờ địa phương, tự động phát hiện đứt chuỗi và loại bỏ ngày tương lai.
  * **Biểu đồ Năng lực Rèn Luyện 5 chiều:** Thể hiện tần suất và mức độ kiên trì tích lũy, không suy đoán năng lực y khoa khi chưa có phép đo thể chất.
  * **Mã QR Code vector thật:** Sinh SVG động từ URL với module `qrcode`, quét được bằng camera điện thoại.
  * Nút "Sao chép liên kết chia sẻ" có kiểm tra trạng thái clipboard bất đồng bộ.

---

### ⏱️ 4. Quick Daily Check-in Widget (1 Chạm 10 Giây)
* **Vị trí:** Đặt ngay đầu trang `/dashboard` và trang `/health`.
* **Xóa bỏ cảm giác gõ form:**
  * Thanh trượt thời lượng ngủ từ 4h đến 12h.
  * 3 hàng Emoji Sliders trực quan cho Giấc ngủ, Năng lượng, Căng thẳng.
  * Nút "Lưu Sinh Hoạt Ngay ✨" hoàn thành trong chưa đầy 10 giây.

---

### 🛡️ 5. AI Synergy Health Guard: Đối Chiếu Sức Khỏe & An Toàn Vận Động
* **Vị trí:** Tự động phân tích trên trang `/health` và trang `/dashboard`.
* **Thuật toán đối chiếu an toàn:**
  * Khớp & Chấn thương: Cảnh báo điều chỉnh các bài tập tác động xấu lên khớp bị đau.
  * Giấc ngủ & Phục hồi: Cảnh báo hạ tải khi ngủ thiếu giấc.
  * Huyết áp: Cảnh báo tránh nín thở gồng tĩnh (Valsalva) khi huyết áp cao.
  * Tôn trọng nguyên tắc không gán nhãn Green Light khi dữ liệu còn thiếu.

---

## 3. Khắc phục triệt để 14 phát hiện từ đợt Review toàn diện (7 Standards + 7 Spec)

### A. Nhóm Chuẩn Mực (Standards S1–S7)
1. **S1 (Quota Upload đồng thời):** Sử dụng cơ chế khóa tuần tự hóa theo người dùng `runWithUserUploadLock(user.id, ...)` trong `uploadHealthDocumentAction`. Ngăn chặn hoàn toàn race condition khi 2 tiến trình upload cùng chạy song song, bảo đảm tổng dung lượng không bao giờ vượt 100MB.
2. **S2 (Xử lý tệp mồ côi):** Chuyển sang quy trình lưu trữ an toàn: Lưu metadata giữ chỗ vào DB trước, sau đó mới upload lên Storage. Nếu DB insert thất bại, file chưa từng tải lên Storage nên không bao giờ phát sinh tệp mồ côi.
3. **S3 (Chặn chèn metadata tùy ý):** Khóa endpoint `createHealthDocumentAction` đối với các yêu cầu chèn metadata thủ công tùy ý từ client, bắt buộc toàn bộ tệp phải qua luồng `uploadHealthDocumentAction` có kiểm soát từ Server.
4. **S4 (Số đo hữu hạn & đúng đơn vị):** 
   * Trong DB Migration: Thêm ràng buộc `CHECK (metric_value > 0 AND metric_value <> 'NaN'::numeric AND metric_value < 'Infinity'::numeric)` và ràng buộc kiểm tra đơn vị nghiêm ngặt theo từng `metric_type`. Chặn hoàn toàn `NaN`, `Infinity`, và cân nặng có đơn vị `cm`.
   * Trong TypeScript contract: Thêm kiểm tra `Number.isFinite(metric_value)` và danh mục đơn vị hợp lệ cho từng loại chỉ số.
5. **S5 (Phân định điểm tích lũy với đo lường thể chất):** Chuyển đổi toàn bộ khái niệm trên thẻ Passport sang **Điểm Tích Lũy Rèn Luyện (Activity & Discipline XP)**. Không tự suy diễn ra sức mạnh đẩy/kéo hoặc khả năng phục hồi từ một buổi tập thông thường.
6. **S6 (Passport ID ổn định & Gỡ nhãn Verified ngộ nhận):** Passport ID được định danh dựa trên tài khoản người dùng, giữ nguyên giá trị khi đổi tên. Gỡ bỏ nhãn "Verified ID" gây hiểu lầm.
7. **S7 (Chặn ghi đè hồ sơ nền sau lỗi đọc):** Khi `healthProfileError` xảy ra, `HealthOverviewTab` khóa nút "Chỉnh sửa" và từ chối submit form, ngăn chặn hoàn toàn việc upsert giá trị null làm mất hồ sơ gốc. Khối `SkillTreeSection` cũng được trang bị màn hình báo lỗi khi `resultsError` xảy ra.

### B. Nhóm Đặc Tả (Spec E1–E7)
1. **E1 & E2 (Chia sẻ Passport, RLS và Dynamic Origin):** 
   * Khi người dùng xem thẻ chia sẻ mà Supabase RLS ẩn dữ liệu của chủ thẻ, trang `/passport` render trạng thái Denied/Not-found rõ ràng, tuyệt đối không ghép ID của người gửi với tên của người xem.
   * Origin chia sẻ được lấy động từ `process.env.NEXT_PUBLIC_SITE_URL` hoặc header môi trường thay vì hardcode.
2. **E3 (Chuỗi ngày Streak chuẩn xác):** 
   * Hàm `calculateStreakDays` sử dụng ngày địa phương (mặc định Asia/Ho_Chi_Minh), tự động loại bỏ các hoạt động có timestamp trong tương lai.
   * Nhận diện chuỗi ngày hiện tại (Current Streak): Nếu không có buổi tập nào hôm nay hoặc hôm qua, streak trả về 0 (chuỗi đã đứt).
   * Nhiều buổi tập trong cùng một ngày địa phương chỉ tính tối đa 1 ngày.
3. **E4 (Đồng bộ Consent Scope AI):** Người dùng chọn riêng từng phạm vi dữ liệu, gồm hồ sơ, mục tiêu, hoạt động, chỉ số tự khai, check-in và huyết áp; dữ liệu sức khỏe chỉ được truy vấn khi đã cấp quyền.
4. **E5 (Khắc phục lệch múi giờ 7 tiếng & Ghi bù Huyết áp):**
   * Xây dựng hàm `toLocalDatetimeInputValue(date)` chuyển đổi Date sang định dạng datetime-local theo giờ máy chuẩn xác.
   * Khi người dùng chỉnh sửa chỉ số mà không đổi ngày giờ, timestamp gốc ISO UTC được bảo toàn nguyên vẹn 100%.
   * Form Huyết áp được bổ sung trường chọn thời điểm đo `measured_at` và nguồn đo `source`, hoàn tất chức năng ghi bù.
5. **E6 (Số reps thực tế cho Live Workout):** Không suy ra số thực hiện từ mục tiêu; người dùng nhập reps thực tế trước khi kết quả được lưu.
6. **E7 (Giới hạn upload trên Vercel):** Server Actions nhận request tối đa 4.5MB; ứng dụng giới hạn file ở 4 MiB để request multipart không vượt giới hạn triển khai.

## Cập nhật sửa lỗi review

- Migration `20261027000008_review_fixes.sql` bổ sung giữ chỗ quota tài liệu có khóa transaction ở database; metadata chỉ chuyển sang `ready` sau khi Storage xác nhận có object. Migration chưa được áp dụng lên database production.
- Tải tài liệu qua server action, giới hạn file 4 MiB và quota 100 MiB mỗi người; client không còn quyền ghi trực tiếp metadata hoặc object Storage.
- Passport chỉ chia sẻ qua token ngẫu nhiên có thể thu hồi; đường dẫn cũ dùng user ID không còn công khai hồ sơ.
- Màn hình consent AI nêu rõ các nhóm dữ liệu được gửi; lịch sử AI lọc reference khi người dùng rút phạm vi.
- Dashboard và Passport tính ngày theo múi giờ trong hồ sơ sức khỏe. Live Workout chỉ lưu reps do người dùng nhập.

---

## 4. Kết quả nghiệm thu kỹ thuật toàn diện

* **Biên dịch TypeScript (`npx tsc --noEmit --incremental false`):** **0 lỗi**.
* **Kiểm thử tự động (`npx vitest run --fileParallelism=false`):** **214/214 tests passed across 20 test suites (100% pass)**.
  * `recheck-standards-extra.test.ts`: 3/3 PASS
  * `spec-passport-recheck.test.tsx`: 1/1 PASS
  * `recheck-integration-extra.test.tsx`: 5/5 PASS
  * `review-experience-findings.test.tsx`: 10/10 PASS
  * `review-v2-findings.test.tsx`: 10/10 PASS
  * `standards-v2-security.test.ts`: 10/10 PASS
  * `health-v2-operations.test.ts`: 11/11 PASS
  * `health-v2-interactive.test.ts`: 15/15 PASS
  * Toàn bộ 12 test suites của các Agent B, C, D, E, F: 149/149 PASS
* **Build Production (`npm run build`):** Compiled successfully 100%, tất cả route động & tĩnh được tối ưu hóa hoàn chỉnh.
