# KỊCH BẢN TRÌNH DIỄN SẢN PHẨM CALISCOACHING
## (Bộ 6 Điểm Nhấn Đột Phá: D1 — D6)

- **Ngày ban hành:** 28/10/2026
- **Mục tiêu:** Trình diễn trọn vẹn giá trị thực tế của ứng dụng CalisCoaching trong việc giải quyết bài toán: *"Ghi nhanh hôm nay, tiếp tục điều đang làm, nhìn lại quá trình có bằng chứng và dùng thông tin có kiểm soát khi cần."*
- **Nguyên tắc an toàn:** Không dùng tài khoản hay thông tin y tế người thật trên môi trường demo; sử dụng dữ liệu giả lập (synthetic fixtures) và cơ chế phân quyền bảo mật RLS thực của Supabase.

---

## 1. KỊCH BẢN TRÌNH DIỄN NHANH 3 PHÚT (RAPID TOUR)

Dành cho các buổi báo cáo nhanh hoặc demo trực quan ngắn:

| Thời lượng | Người trình diễn thực hiện | Người xem hiểu được giá trị gì |
|---|---|---|
| **0:00 – 1:00** | Vào `/dashboard` → Bấm **"Ghi 1 câu"** → Nhập: `"Chạy bộ 25 phút công viên, ngủ 7 tiếng, đo huyết áp 120/80"` → Hệ thống lập tức bóc tách thành 3 bản ghi riêng biệt: Hoạt động (Chạy bộ), Check-in (Giấc ngủ) và Chỉ số y tế (Huyết áp) → Sửa nhanh thông số trực tiếp trên preview → Bấm **Lưu** → Xem receipt và liên kết mở Lịch sử. | **D1 — Nhập liệu siêu tốc:** Không cần mở 3 form phức tạp; phân tách tự nhiên tiếng Việt, kiểm tra trước khi ghi nhận, có biên nhận liên kết nguồn gốc. |
| **1:00 – 2:00** | Trở về Hôm nay → Thẻ **"Buổi tập đang diễn ra"** hiển thị ngay đầu màn hình → Bấm **"Tiếp tục"** (`/workout`) → Xem kết quả các hiệp của buổi trước để tham khảo mức tạ/reps → Nhập hiệp 1 thực tế → **Tải lại trang (F5) hoặc giả lập mất mạng** → Màn hình lập tức phục hồi trạng thái từ Outbox hàng đợi → Hoàn thành buổi tập. | **D3 — Trí nhớ & Tính liên tục:** Không bao giờ mất dữ liệu đang tập dở; state machine bền vững, hoạt động ổn định kể cả khi gián đoạn kết nối. |
| **2:00 – 3:00** | Vào mục **Cá nhân** (`/profile`) → Chọn **"Bản tóm tắt chia sẻ"** (`/briefs`) → Bấm **"Tạo bản tóm tắt mới"** → Chọn mục đích "Gửi Huấn Luyện Viên" → Hệ thống tự động loại trừ các ghi chú nhạy cảm → Tạo link chia sẻ bí mật có thời hạn 48 giờ → Mở cửa sổ ẩn danh (Recipient) xem snapshot an toàn → Quay lại màn hình chính bấm **"Thu hồi" (Revoke)** → Tab khách reload và lập tức bị từ chối truy cập. | **D2 — Chia sẻ có kiểm soát:** Hồ sơ mang đi trao đổi không lộ toàn bộ lịch sử bệnh lý; link có thời hạn và quyền thu hồi tức thì nằm trong tay người dùng. |

---

## 2. KỊCH BẢN TRÌNH DIỄN ĐẦY ĐỦ 10 PHÚT (COMPREHENSIVE WALKTHROUGH)

Trình diễn toàn diện chuỗi hành trình người dùng xuyên suốt 6 điểm nhấn:

```
[Vào Hôm nay] ➔ [Ghi nhanh D1] ➔ [Tiếp tục tập D3] ➔ [Hành trình kỹ năng D4 & Video D6]
     ➔ [Hồ sơ sức khỏe & AI] ➔ [Bản tóm tắt an toàn D2] ➔ [Nhóm đồng hành D5] ➔ [Xác nhận Invalidation]
```

### Chi tiết từng phân đoạn:

#### Phân đoạn 1: Mở màn & Nhận diện trạng thái (0:00 – 0:45)
- **Hành động:** Mở ứng dụng tại `/dashboard`, đăng nhập tài khoản User A.
- **Điểm nhấn trực quan:** Màn hình chào mừng nhận ra ngay việc người dùng đang có một buổi tập calisthenics dở dang từ trước. Thẻ `<ResumeWorkoutCard />` xuất hiện ở vị trí ưu tiên số 1, hiển thị thời gian đã trôi qua và tiến độ các hiệp.
- **Thông điệp:** Ứng dụng tập trung vào hành động thực tế tiếp theo của người dùng, không bắt người dùng phải duyệt qua các bảng số liệu rườm rà.

#### Phân đoạn 2: Ghi nhanh một câu có biên nhận (0:45 – 2:00)
- **Hành động:**
  1. Nhấn nút **"Ghi 1 câu"** trên Header hoặc Banner `<QuickCaptureLauncher />` để chuyển tới `/capture`.
  2. Gõ câu tiếng Việt: `"Chạy 30 phút bờ hồ, đêm qua ngủ 6.5 tiếng, cân nặng sáng nay 66.2kg"`.
  3. Quan sát hệ thống phân tích thành:
     - 1 Hoạt động: Chạy bộ (30 phút, `calisthenics/running`).
     - 1 Check-in ngày: Giấc ngủ 6.5 giờ.
     - 1 Chỉ số thể chất: Cân nặng 66.2 kg.
  4. Chỉnh sửa nhẹ thời gian chạy từ 30 thành 35 phút ngay trên thẻ xem trước.
  5. Bấm **"Xác nhận lưu hồ sơ"** → Receipt hiển thị thông báo thành công kèm link mở Lịch sử.
  6. Chuyển sang tab **Lịch sử** (`/activities`) để thấy bản ghi chạy bộ vừa xuất hiện với nhãn nguồn gốc `quick_capture`.

#### Phân đoạn 3: Tiếp tục buổi tập có trí nhớ & Persistence (2:00 – 3:45)
- **Hành động:**
  1. Bấm vào buổi tập đang dở để mở `/workout/[runId]`.
  2. Xem badge *"Lần trước: 8 reps"* tại bài tập Pull-up.
  3. Nhập số lần thực hiện hiệp hiện tại là 9 reps (vượt mục tiêu).
  4. Bấm **"Tạm dừng" (Pause)** → Đóng tab trình duyệt hoặc F5 tải lại trang.
  5. Mở lại trang: Phiên tập khôi phục nguyên vẹn trạng thái tạm dừng, đồng hồ tính giờ chính xác, các hiệp đã nhập được giữ nguyên từ hàng đợi Outbox.
  6. Bấm **"Tiếp tục"** và hoàn tất buổi tập → Màn hình hiển thị bản tóm tắt kết quả.
  7. Bấm tùy chọn **"Gắn kết quả vào hành trình kỹ năng"** để chuyển dữ liệu sang phân đoạn tiếp theo.

#### Phân đoạn 4: Hành trình kỹ năng có bằng chứng & Video đối chiếu (3:45 – 5:00)
- **Hành động:**
  1. Mở tab **Tập luyện** (`/programs`) → Bấm **"Mở hành trình"** dẫn tới `/journey`.
  2. Xem hành trình mẫu *"Chinh phục Hít xà đơn (Pull-up Mastery)"* với 4 mốc rõ ràng (`Dead Hang 30s` ➔ `Inverted Row 8` ➔ `Negative Pull-up 5` ➔ `Standard Pull-up 1`).
  3. Giải thích tính độc lập: Mốc kỹ năng được tính theo 4 trạng thái (`not_attempted`, `attempted`, `self_reported_achieved`, `needs_review`), hoàn toàn không bị ảnh hưởng bởi việc cày cuốc điểm XP ảo.
  4. Bấm vào chi tiết mốc `Standard Pull-up 1` để xem lịch sử 2 lần thử (1 lần 0 rep - chưa đạt, 1 lần 1 rep - tự ghi đạt).
  5. Bấm nút **"Phòng đối chiếu video"** (`/journey/compare`):
     - Chọn Clip A (Lần thử tuần trước: Form còn văng chân).
     - Chọn Clip B (Lần thử hôm nay: Thân người thẳng, kéo cằm qua xà).
     - Bấm **"Phát đồng bộ" (Sync Play)** và chỉnh tốc độ chậm `0.5x` để quan sát sự cải thiện quỹ đạo chuyển động khớp vai.

#### Phân đoạn 5: Hồ sơ sức khỏe V2 & Trợ lý AI có trích dẫn nguồn (5:00 – 6:00)
- **Hành động:**
  1. Vào tab **Cá nhân** (`/profile`) → Mở **"Hồ sơ sức khỏe V2"** (`/health`).
  2. Quan sát các nhóm thông tin: Tiền sử chấn thương, thuốc tự khai và tài liệu sức khỏe đã được chuẩn hóa.
  3. Bấm vào banner **"Trợ lý Hỏi đáp & Phân tích"** dẫn tới `/ai`.
  4. Đặt câu hỏi: *"Khối lượng tập kéo của tôi trong 2 tuần qua thay đổi như thế nào so với mục tiêu?"*.
  5. Quan sát câu trả lời của AI: Chỉ sử dụng các hoạt động đã được cấp quyền, hiển thị danh sách trích dẫn nguồn cụ thể kèm ngày giờ (không tự suy diễn nhân quả hay phán đoán y tế).

#### Phân đoạn 6: Tạo bản tóm tắt trao đổi & Thu hồi quyền (6:00 – 7:30)
- **Hành động:**
  1. Tại trang Cá nhân, chọn **"Bản tóm tắt chia sẻ"** (`/briefs`) → Bấm **"Tạo bản tóm tắt mới"**.
  2. Đặt tiêu đề: *"Tóm tắt thể lực gửi HLV Thể hình"*, chọn phạm vi: Chỉ gửi hoạt động tập luyện và số đo thể chất trong 30 ngày qua, loại trừ tiền sử bệnh án.
  3. Xem trước (Preview) nội dung sẽ được xuất bản.
  4. Bấm **"Tạo liên kết chia sẻ"** → Hệ thống sinh mã token ngẫu nhiên và mã QR có thời hạn 48 giờ.
  5. Sao chép liên kết, mở trong Cửa sổ Ẩn danh (Private Window) để đóng vai Huấn luyện viên:
     - Giao diện người nhận hiển thị snapshot tĩnh, sạch sẽ, không có Bottom Navigation hay thanh menu của chủ sở hữu.
  6. Quay lại cửa sổ chính của User A, bấm nút **"Thu hồi liên kết" (Revoke)**.
  7. Quay lại cửa sổ ẩn danh và F5 tải lại trang: Hệ thống lập tức thông báo *"Liên kết này đã bị chủ sở hữu thu hồi hoặc hết hiệu lực."*

#### Phân đoạn 7: Nhóm nhỏ cùng giữ cam kết (7:30 – 8:45)
- **Hành động:**
  1. Mở tab **Đồng hành** (`/groups`): Xem nhóm nhỏ *"Calis Kỷ Luật 4 Người"*.
  2. Xem danh sách cam kết tuần: Mỗi thành viên có một mục tiêu riêng (ví dụ: Thành viên A cam kết tập 3 buổi kéo, Thành viên B cam kết đi bộ 10.000 bước).
  3. Nhấn nút cập nhật tiến độ tự nguyện: Hoàn thành 1 buổi cam kết.
  4. Quan sát: Nhóm chỉ thể hiện tỷ lệ hoàn thành cam kết tập thể, không có bảng xếp hạng hơn thua, không công khai video riêng tư hay hồ sơ bệnh án của bất kỳ ai.

#### Phân đoạn 8: Đóng vòng lặp & Xác nhận Invalidation tự động (8:45 – 10:00)
- **Hành động:**
  1. Quay lại tab **Lịch sử** (`/activities`): Mở buổi tập calisthenics nền vừa ghi nhận.
  2. Thực hiện thao tác chỉnh sửa thời gian hoặc xóa buổi tập này.
  3. Quay lại tab **Tập luyện** ➔ **Hành trình kỹ năng** (`/journey`):
     - Mốc kỹ năng liên kết với buổi tập vừa bị chỉnh sửa lập tức đổi trạng thái sang badge màu vàng **"Cần xem xét lại (needs_review)"**.
     - Xuất hiện thông báo lý do: *"Hoạt động nền liên kết đã bị chỉnh sửa hoặc xóa khỏi nhật ký."*
- **Kết luận thuyết trình:** CalisCoaching đảm bảo tính toàn vẹn dữ liệu từ gốc tới ngọn; mọi tiến bộ đều có bằng chứng có thể kiểm chứng được, an toàn và hoàn toàn minh bạch.

---

## 3. CHECKLIST CHUẨN BỊ MÔI TRƯỜNG DEMO (DEMO SETUP CHECKLIST)

Trước khi bắt đầu buổi trình diễn, kiểm tra các yếu tố sau:
- [x] Chạy migration đầy đủ trên cơ sở dữ liệu demo (`20261028000010` đến `20261028000013`).
- [x] Tạo sẵn tài khoản User A (`usera@example.com`) với 1 buổi tập đang dở và 1 nhóm cam kết.
- [x] Nạp 2 video ngắn mẫu (15–30 giây, định dạng MP4 < 10 MiB) vào bucket `comparison_videos`.
- [x] Kiểm tra kết nối mạng và đảm bảo server chạy lệnh `npm run dev` hoặc `npm run start` ổn định.
- [x] Chuẩn bị sẵn 1 cửa sổ trình duyệt thường (User A) và 1 cửa sổ ẩn danh (Recipient).
