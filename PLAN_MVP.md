# Kế hoạch MVP — Hồ sơ sức khỏe và vận động cá nhân

Cập nhật 27/10/2026. Nhóm có 2 thành viên kỹ thuật dùng TypeScript, 1 thành viên kinh tế; thời hạn cuộc thi, quỹ giờ và nhà cung cấp AI chưa xác định. Mốc 6 tuần là giả định, cần điều chỉnh theo thực tế. Tên sản phẩm chưa chốt.

## 1. Mục tiêu

Kiểm chứng liệu một hồ sơ cá nhân cập nhật từ mục tiêu, thông tin tự nhập và nhiều hoạt động, kết hợp tương tác AI dựa trên chính hồ sơ đó, có giúp người dùng hiểu quá trình và biết thông tin nào cần xem xét khi sắp xếp việc tập hay không.

Calisthenics là nội dung tập luyện đầu tiên; chạy bộ, cầu lông và hoạt động khác được nhập thủ công để thử lịch chung. MVP phục vụ trực tiếp người dùng qua AI. Tính năng chia sẻ và kết nối HLV là hướng phát triển sau.

Giả thuyết cần kiểm chứng: người dùng muốn tạo/cập nhật hồ sơ; thấy tóm tắt và hỏi đáp AI dựa trên dữ liệu có ích; muốn ghi và xem nhiều hoạt động; quay lại sử dụng và có thể quan tâm trả phí. Chưa có kết quả xác nhận.

Luồng chính: đăng nhập → tạo hồ sơ/mục tiêu → ghi hoạt động → xem tổng quan → yêu cầu AI tóm tắt hoặc đặt câu hỏi → xem câu trả lời và dữ liệu tham chiếu → chọn nội dung tập calisthenics minh họa và ghi kết quả → hồ sơ được cập nhật.

## 2. Phạm vi và nghiệm thu

P0 cần để chứng minh vòng sử dụng; P1 bổ sung sau khi P0 chạy. Tất cả là kế hoạch, chưa khẳng định đã xây xong.

| Ưu tiên | Hạng mục | Hành vi và điều kiện đạt |
|---|---|---|
| P0 | Tài khoản | Người dùng chỉ đọc/sửa dữ liệu của mình; kiểm tra trực tiếp server và RLS. |
| P0 | Hồ sơ và mục tiêu | Lưu/sửa mục tiêu, kinh nghiệm, thời gian, dụng cụ; chiều cao/cân nặng tùy chọn, có ngày và nguồn; không yêu cầu bệnh án. |
| P0 | Nhật ký chung | Thêm/sửa/xóa hoạt động calisthenics, chạy, cầu lông, đi bộ hoặc khác; ngày giờ, thời lượng, mức mệt và ghi chú tùy chọn. |
| P0 | Tổng quan | Hiển thị mục tiêu, lịch sử, kết quả và cảm nhận, nguồn và thời gian; chỉnh/xóa cập nhật các số tổng hợp; thể hiện dữ liệu thiếu. |
| P0 | AI tóm tắt hồ sơ | Gọi mô hình thật qua server khi có cấu hình và người dùng đồng ý; tóm tắt theo dữ liệu hiện có, nêu khoảng thời gian, nguồn và dữ liệu còn thiếu. Lỗi hoặc không có khóa: dùng bản tổng hợp theo mẫu có nhãn không dùng AI. |
| P0 | Hỏi đáp AI theo hồ sơ | Người dùng đặt câu hỏi như “Tuần này tôi đã ghi những hoạt động nào?”. AI trả lời dựa trên phần hồ sơ được phép, dẫn các bản ghi hoặc khoảng thời gian dùng và nói rõ khi thiếu dữ liệu. Không tự sửa hồ sơ. Khi AI lỗi, thông báo và cho thử lại; không giả lập câu trả lời AI. |
| P0 | Calisthenics | Một nội dung/buổi tập mẫu, ghi kết quả và cập nhật hồ sơ. Khi chưa có nguồn chuyên môn đủ căn cứ, gắn nhãn minh họa và chỉ dùng trong demo; không công bố là giáo án đã xác thực. |
| P1 | Xem lại lịch nhiều hoạt động | Hiển thị các hoạt động gần nhau và gợi ý xem lại lịch theo quy tắc được nêu rõ; nêu dữ liệu tham chiếu, không tự đổi tải hay kết luận phục hồi. Ngưỡng chưa có căn cứ chỉ dùng cho demo. |
| P2 | Sau MVP | Chia sẻ hồ sơ cho HLV, phản hồi HLV và QR; AI phân tích video; dinh dưỡng/calo; Strava/wearable; nhiều chương trình; thanh toán; app native. |

MVP không phụ thuộc vào việc tìm HLV để xây ứng dụng và kiểm chứng trải nghiệm hồ sơ, nhật ký, AI với người dùng thật. Có thể pilot các chức năng này bằng dữ liệu người dùng tự cung cấp và đồng ý chia sẻ với AI. Nội dung tập và quy tắc chưa có căn cứ chỉ dùng tình huống minh họa; trước khi giới thiệu cho người dùng tập theo hoặc đưa khuyến nghị cá nhân, cần rà soát nội dung dựa trên nguồn chuyên môn phù hợp và xác định phạm vi sử dụng. Không mặc định AI tạo nội dung là đã được kiểm chứng.

## 3. Công nghệ và tương tác AI

Dự kiến Next.js + TypeScript, web ưu tiên điện thoại; Supabase Auth/Postgres, migration và RLS. Chọn phiên bản tương thích khi triển khai; khóa và credential chỉ ở server. Tài khoản demo tách dữ liệu pilot.

AI qua adapter ở server, có hai thao tác: tạo tóm tắt và trả lời câu hỏi theo hồ sơ. Chỉ gửi dữ liệu tối thiểu trong phạm vi người dùng đồng ý; hiển thị rõ loại dữ liệu chia sẻ, nhà cung cấp được cấu hình và cách thu hồi theo thiết kế. Ghi chú và câu hỏi là dữ liệu không đáng tin; không làm thay đổi chỉ dẫn hệ thống. Câu trả lời dựa trên dữ liệu đã cung cấp, nêu nguồn/thời gian và thừa nhận không biết. AI không chẩn đoán, kê đơn, kết luận hồi phục, tự thay đổi lịch/tải hay ghi dữ liệu thay người dùng. Câu hỏi ngoài phạm vi được trả lời phù hợp giới hạn sản phẩm.

Trước khi dùng dữ liệu thật: rà soát điều kiện xử lý dữ liệu của nhà cung cấp AI, cấu hình bảo mật và sự đồng ý; không đưa dữ liệu thật vào log, fixture hoặc debug. Không tự đồng bộ dữ liệu Strava; kiểm tra chính sách nhà cung cấp trước bất kỳ tích hợp nào.

## 4. Hợp đồng dữ liệu

Người phụ trách nền chốt schema và types trước khi giao song song. Mọi thay đổi schema qua migration, cập nhật types và thông báo các phần phụ thuộc.

- Profile: user_id, tên hiển thị, kinh nghiệm, lịch rảnh, dụng cụ, created_at/updated_at.
- Goal: id, user_id, nội dung/loại, trạng thái, ngày bắt đầu/kết thúc tùy chọn.
- Observation: id, user_id, loại, giá trị/đơn vị, observed_at, nguồn tự khai; không tạo điểm sức khỏe tổng hợp.
- Activity: id, user_id, loại, start_at, duration_minutes, mức mệt/notes tùy chọn, source, created_at/updated_at; phân biệt hoạt động thực tế với lịch dự kiến.
- Program/session/result: chủ sở hữu, phiên bản nội dung, trạng thái minh họa hoặc đã rà soát, kết quả tự khai, thời điểm; chống ghi trùng.
- Review suggestion: user_id, trạng thái, lý do, IDs hoạt động tham chiếu, phiên bản quy tắc, thời điểm; đánh dấu cũ khi dữ liệu thay đổi.
- AI summary: user_id, phạm vi đầu vào, thời điểm, trạng thái AI hoặc mẫu, nội dung, dữ liệu thiếu và tham chiếu bản ghi; là ảnh chụp và cho phép tạo lại.
- AI conversation/message: user_id, vai trò, nội dung, created_at, trạng thái và nguồn tham chiếu; người dùng xem/xóa lịch sử theo thiết kế. Khi nguồn thay đổi, câu trả lời cũ giữ ngày tạo và không được trình bày là dữ liệu mới nhất.
- AI consent: user_id, phiên bản nội dung đồng ý, phạm vi và thời điểm; hành động rút lại không gửi thêm dữ liệu cho các yêu cầu sau.

Mỗi bản ghi có chủ sở hữu, thời gian rõ múi giờ. Giá trị thiếu là null, không suy ra bằng 0; dữ liệu minh họa được gắn nhãn. Chỉ lưu lịch sử chat nếu người dùng được thông báo và có cách xóa.

## 5. Demo và pilot

Demo: mở hồ sơ mẫu → ghi calisthenics và cầu lông → xem lịch chung → tạo tóm tắt AI có nguồn → hỏi “Tuần này tôi đã ghi gì?” → nhận câu trả lời có tham chiếu → xem nội dung calisthenics minh họa, ghi kết quả → hồ sơ cập nhật. Nếu provider lỗi, tóm tắt theo mẫu được gắn nhãn, hỏi đáp báo không khả dụng và cho thử lại. Có video demo dự phòng, nêu phần minh họa.

Pilot trải nghiệm hồ sơ, nhật ký và AI không cần HLV. Trước pilot: giải thích loại dữ liệu gửi tới AI, có đồng ý và cách xóa/rút lại; kiểm tra quyền giữa tài khoản; đánh giá nội dung, rủi ro và cấu hình provider; AI lỗi không chặn các phần khác. Các bài/khuyến nghị chưa được rà soát được gắn nhãn demo, không hướng dẫn người thật tập theo như giáo án đã xác thực.

Chỉ số: số người hoàn thành hồ sơ, ghi buổi đầu và quay lại; số người hỏi AI và câu hỏi thường gặp; độ đúng và đủ nguồn của tóm tắt/câu trả lời; lỗi thiếu dữ liệu, độ trễ và chi phí mỗi lượt; phản hồi và sẵn sàng trả phí. Chọn cỡ mẫu/ngưỡng trước pilot, báo kết quả thực tế, không suy diễn hiệu quả sức khỏe.

## 6. Phân công agent

Đọc PROMPT_AGENT_MVP.md. Điều phối chốt hợp đồng, sở hữu schema/auth và tích hợp các thay đổi. Thứ tự: A nền → B hồ sơ và C nhật ký song song → D nội dung calisthenics/quy tắc demo → E AI tóm tắt và hỏi đáp → F tích hợp. D/E có thể làm song song sau khi hợp đồng B/C đủ rõ. Một agent có thể làm nhiều vai trò tuần tự; tránh sửa trùng tệp. Từng agent báo tệp, lệnh và kết quả kiểm tra, phần còn thiếu và phụ thuộc.

## 7. Lộ trình dự kiến 6 tuần

| Tuần | Kỹ thuật | Người phụ trách kinh tế | Mốc |
|---|---|---|---|
| 1 | Khung TypeScript, auth, schema, hồ sơ | Phỏng vấn, xác định nhóm thử | Hồ sơ lưu được |
| 2 | Nhật ký, tổng quan, lịch sử, nội dung tập demo | Quan sát nhu cầu và cách dùng | Hồ sơ → ghi hoạt động → xem lại |
| 3 | Tóm tắt AI, fallback, cơ chế đồng ý | Tuyển người dùng thử | Tóm tắt có nguồn, lỗi có phương án |
| 4 | Hỏi đáp theo hồ sơ, lịch nhiều hoạt động, ghép luồng | Chuẩn bị thử nghiệm và câu hỏi khảo sát | AI trả lời có dữ liệu tham chiếu |
| 5 | Sửa lỗi và theo dõi | Pilot hồ sơ/AI; ghi chi phí và phản hồi | Có dữ liệu sử dụng hoặc ghi rõ trở ngại |
| 6 | Ổn định, kiểm tra quyền, demo dự phòng | Tổng hợp bằng chứng, thử giá, pitch | Demo xuyên suốt và số liệu đúng trạng thái |

Nếu chậm, hoãn QR, video, dinh dưỡng, kết nối và quy tắc lịch nâng cao. Giữ quyền truy cập, dữ liệu minh họa được gắn nhãn và khả năng dùng app khi AI lỗi.

## 8. Kiểm tra hoàn thành

Kiểm tra tài khoản A không truy cập B qua API; sửa/xóa hoạt động cập nhật tổng quan và đánh dấu gợi ý cũ; nhấn lưu lặp không nhân đôi; AI lỗi không chặn hồ sơ, mẫu không giả là AI; câu hỏi theo hồ sơ có nguồn và không bịa dữ liệu thiếu; ghi chú chứa chỉ dẫn độc hại không đổi hành vi; rút đồng ý ngăn lần gửi tiếp theo; người dùng xóa lịch sử chat; bài tập chưa kiểm chứng có nhãn; luồng chạy trên điện thoại. Ghi lệnh, kết quả và phần chưa xác minh. Không dùng dữ liệu thật trong log/fixture.


## 9. Định vị cạnh tranh

Cập nhật 27/10/2026, dựa trên `CalisCoaching_danh_gia_tinh_moi.md` và `QR_ho_so_doi_chieu_san_pham.md` (mô tả công khai của nhà phát triển, kiểm tra 26/10/2026, chưa kiểm thử độc lập). Đây là giả thuyết cần kiểm chứng qua pilot, không phải lợi thế đã xác nhận.

Từng thành phần riêng lẻ đã có tiền lệ: chấm video calisthenics (Calisthenics AI: Coach, CaliLens), cây kỹ năng và tự điều chỉnh độ khó (Calistree, Freeletics), lập lịch đa môn thích ứng (Pelaris, Athletica), phản hồi camera nhiều môn (AICoach), QR mở hồ sơ (PlayerAID, Iron Club, Promesa, Run This). Không tuyên bố “chưa ai làm”; trình bày tổ hợp cụ thể cho nhóm người dùng cụ thể, kèm số liệu pilot.

| Hướng khác biệt | Nội dung | Giai đoạn |
|---|---|---|
| 1. Hồ sơ đa môn, xét lịch xuyên môn | Một hồ sơ cho calisthenics, cầu lông, chạy, đi bộ; chỉ ra hoạt động gần nhau kèm lý do và bản ghi nguồn; không tự đổi tải hay kết luận phục hồi. | **MVP** (nền đã có: nhật ký C, quy tắc xem lại lịch D) |
| 2. AI minh bạch | Mỗi nhận định trích dẫn bản ghi; phân biệt tự khai với dữ liệu được xác nhận; nói rõ khi thiếu dữ liệu; bản mẫu không giả là AI. | **MVP** (E) |
| 3. HLV trong vòng kiểm soát | AI tổng hợp và đề xuất chuyển cấp từ bằng chứng nhiều buổi, có ngưỡng từ chối khi dữ liệu kém; HLV duyệt. Thước đo: giảm quyết định chuyển cấp không phù hợp ở cùng số phút HLV. | Sau MVP (P2), là hướng có thể thành đóng góp riêng |
| 4. Người tập sở hữu dữ liệu | Chia sẻ có phân quyền (kể cả QR), HLV xác nhận kết quả, hồ sơ mang theo khi đổi HLV/CLB. QR tự thân không phải điểm mới. | Sau MVP (P2) |

Rào cản khó sao chép không nằm ở mô hình AI (có thể mua) mà ở dữ liệu tích lũy theo thời gian, mạng lưới HLV/CLB địa phương tham gia xác nhận và bộ quy tắc chuyên môn đã được rà soát. Ngôn ngữ tiếng Việt hoặc thị trường địa phương tự thân chưa tạo khác biệt công nghệ.

Khi trình bày: tập trung hướng 1 + 2 trong demo, hướng 3 + 4 là lộ trình có câu hỏi kiểm chứng rõ. Bằng chứng ưu tiên là chỉ số ở mục 5 (quay lại tuần thứ hai, đánh giá hữu ích và độ đúng nguồn của AI, sẵn sàng trả phí), ghi đúng trạng thái demo/minh họa.
