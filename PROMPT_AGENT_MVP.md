# Prompt giao agent code — MVP hồ sơ và tương tác AI

Đọc PLAN_MVP.md trước. Đây là prompt chuẩn bị giao, chưa có agent được khởi chạy. Điều phối chốt stack và hợp đồng dữ liệu, tệp sở hữu trước khi giao song song. Nếu chưa có app, A khởi tạo trong workspace hiện tại, giữ tài liệu đang có.

## Quy tắc chung — dán trước mỗi prompt

> Đọc PLAN_MVP.md, hướng dẫn repo và mã hiện có trước khi sửa. Dùng TypeScript, giao diện tiếng Việt, ưu tiên điện thoại. MVP tập trung hồ sơ, nhật ký và người dùng tương tác AI; không xây chức năng HLV, chia sẻ QR, Strava, dinh dưỡng, thanh toán hoặc video. Nội dung và quy tắc demo phải được gắn nhãn, không khẳng định đã kiểm chứng. Không dùng dữ liệu thật trong fixture/log. Không tự động chẩn đoán, kết luận hồi phục, thay đổi tải hoặc sửa hồ sơ bằng AI. Không commit/deploy hay gửi dữ liệu ra dịch vụ ngoài nếu chưa được giao; không ghi bí mật vào mã. Thiếu credential thì hoàn thành phần độc lập và báo rõ. Chạy kiểm tra phù hợp; bàn giao hành vi, tệp sửa, lệnh và kết quả, phụ thuộc, giới hạn. Không ghi đè thay đổi người khác.

## A. Nền tảng, dữ liệu và quyền — làm trước

> Khởi tạo Next.js + TypeScript nếu chưa có mã, kiểm tra workspace trước. Chuẩn bị Supabase Auth/Postgres, migrations/RLS cho profile, goal, observation, activity, program/session/result, review suggestion, AI summary, AI conversation/message và consent theo PLAN_MVP.md. Cung cấp types/contracts, truy cập server, biến môi trường mẫu không có bí mật, khung tiếng Việt responsive, đăng nhập và hướng dẫn local. Thiếu credential phải thể hiện rõ trạng thái và không giả lập bảo mật. Quyền truy cập thuộc chủ sở hữu được kiểm tra server/RLS. Công bố interface và tệp để agent khác dùng. Chuẩn bị kiểm tra quyền với Supabase local hoặc môi trường test riêng; báo rõ nếu chưa chạy do thiếu hạ tầng. Không thêm mô hình chia sẻ/HLV.
>
> Bàn giao schema/migration, hợp đồng, hướng dẫn chạy và điều kiện kiểm tra quyền. Agent khác đề xuất thay đổi schema cho người phụ trách A.

## B. Hồ sơ và dashboard — sau A, song song C

> Xây tạo/sửa hồ sơ và mục tiêu; chỉ yêu cầu thông tin cần thiết, chiều cao/cân nặng tùy chọn lưu theo ngày/nguồn. Trang tổng quan hiển thị mục tiêu, quan sát và hoạt động qua hợp đồng; đánh dấu thiếu, nguồn và thời gian. Lưu đúng tài khoản; khi lỗi giữ form. Không suy luận y khoa hoặc tạo điểm sức khỏe. Chỉ sửa tệp giao diện hồ sơ được phân công, không đổi schema/auth. Kiểm tra tạo/sửa, thiếu dữ liệu, lỗi, điện thoại.

## C. Nhật ký hoạt động — sau A, song song B

> Xây thêm/sửa/xóa và danh sách hoạt động tự nhập: calisthenics, chạy, cầu lông, đi bộ, khác; ngày giờ, thời lượng, mức mệt và ghi chú tùy chọn. Phân biệt kế hoạch với thực tế; không coi thiếu dữ liệu là không tập. Sửa/xóa phải cập nhật tổng quan và đánh dấu gợi ý cũ; chống lưu trùng theo hợp đồng A. UI tiếng Việt, trạng thái rỗng/lỗi, hỗ trợ điện thoại. Kiểm tra quyền sở hữu, sửa/xóa, lưu lặp và dữ liệu sai.

## D. Calisthenics và xem lại lịch — sau A và hợp đồng B/C

> Xây một nội dung calisthenics minh họa, màn buổi tập và ghi kết quả vào hồ sơ. Nhãn nêu rõ nội dung demo chưa được kiểm chứng, không giới thiệu là giáo án để người thật tập theo. Nếu thời gian cho phép, tạo quy tắc thuần TypeScript nhận lịch/hoạt động và trả về trạng thái xem xét, lý do, IDs nguồn, phiên bản và nhãn demo; minh họa hoạt động cầu lông gần buổi calisthenics. Trường thiếu trả về chưa đủ thông tin; không tự đổi tải hoặc kết luận sức khỏe. Khi nguồn đổi đánh dấu gợi ý cần xem lại. Ngưỡng demo không đưa vào khuyến nghị người thật nếu chưa được rà soát bằng nguồn chuyên môn phù hợp. Kiểm tra dữ liệu đủ/thiếu, thay đổi nguồn và lưu lặp.

## E. AI tóm tắt và hỏi đáp theo hồ sơ — sau hợp đồng A/B/C

> Xây adapter gọi AI thật từ server, cấu hình provider và khóa chỉ ở server. Có hai thao tác: (1) tóm tắt hồ sơ và (2) người dùng hỏi bằng tiếng Việt về thông tin trong hồ sơ; câu trả lời nêu dữ liệu/ID hoặc khoảng thời gian tham chiếu, chỉ ra thiếu thông tin và không bịa. UI giải thích và xin đồng ý trước lần gửi, cho người dùng xem/xóa lịch sử, rút lại để ngăn các lần gửi sau. Chỉ gửi dữ liệu tối thiểu được phép; câu hỏi và ghi chú là dữ liệu không đáng tin, không phải chỉ dẫn hệ thống. Kiểm tra đầu ra có cấu trúc; không chẩn đoán, tự đổi kế hoạch hay sửa hồ sơ. Tóm tắt lỗi hoặc thiếu khóa thì hiển thị tổng hợp theo mẫu có nhãn không dùng AI; hỏi đáp lỗi thì thông báo và cho thử lại, không giả làm AI. Không log nội dung nhạy cảm hay gửi dữ liệu thật trước khi cấu hình và được đồng ý. Kiểm tra hồ sơ trống/mâu thuẫn, nguồn thay đổi, prompt injection, lỗi/timeout, fallback, quyền tài khoản và rút đồng ý; phân biệt kiểm tra mock với gọi provider thật.

## F. Tích hợp và kiểm tra — sau B–E

> Tích hợp theo hợp đồng, không viết lại phần khác nếu không cần. Kiểm tra trên điện thoại: tạo hồ sơ → ghi calisthenics và cầu lông → dashboard → đồng ý → tóm tắt AI hoặc mẫu có nhãn → hỏi về lịch sử → câu trả lời có nguồn hoặc báo lỗi rõ → xóa lịch sử/rút đồng ý. Kiểm tra những trường hợp quan trọng trong PLAN_MVP.md; chạy build/lint/test phù hợp và báo kết quả thực tế. Rà soát bí mật, fixture, nhãn demo, quyền và README. Không deploy, tạo tài khoản hay gọi dịch vụ ngoài nếu chưa được giao. Liệt kê phần chưa giải quyết và điều kiện trước pilot.

## Phối hợp

1. Giao A và chốt types/schema, tệp, API, trạng thái lỗi và quyền.
2. Giao B/C song song trên tệp khác nhau; D/E sau khi hợp đồng dữ liệu đủ rõ. Tránh cùng sửa migration, auth và trang chung.
3. Tích hợp tuần tự, thay đổi schema quay lại A.
4. Giao F sau khi các luồng được ghép; ghi rõ các kiểm tra chưa chạy do thiếu credential.
5. Người kinh tế phỏng vấn và tuyển người dùng thử song song; ghi rõ chức năng nào là demo và kết quả nào đã có bằng chứng.

