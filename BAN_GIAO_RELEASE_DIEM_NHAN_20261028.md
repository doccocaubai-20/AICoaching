# Bản sửa phát hành điểm nhấn — 28/10/2026

## Thay đổi

- Giữ các bản sửa WIP của nhóm và hoàn thiện các phát hiện còn mở sau `0c53e4d`.
- Chặn chia sẻ chéo chủ sở hữu ở database và RPC; payload công khai được dựng bằng allowlist cả trường lồng nhau, bỏ ID nguồn và token xác nhận.
- Preview có chữ ký server gắn với người dùng, lựa chọn và phiên bản dữ liệu. Thay đổi sau preview yêu cầu xem lại trước khi lưu.
- Video: chỉ cấp upload qua server, giữ nguyên đường dẫn khi retry, tính quota cả reservation/tombstone/object còn tồn tại, dùng size/MIME thực từ Storage. Không giải phóng ledger trước khi xóa vật lý. Grant upload có hạn 2 giờ theo Supabase; giữ tối đa 20 MiB mỗi lượt trong 130 phút để tránh token còn hiệu lực vượt quota. Lượt tải tiếp theo thử dọn các object hết hạn của chính tài khoản.
- Chứng cứ kỹ năng chỉ nhận buổi tập có hiệp thực, đúng động tác/biến thể/hỗ trợ/đơn vị. Kiểm cùng ràng buộc khi lưu ở database. Nguồn bị sửa chuyển lần thử sang cần xem lại.
- Sau buổi tập, lấy đúng activity/session-result theo run đã xác minh; mở chứng cứ ở Journey hoặc chọn nhóm và xem nháp cam kết trước khi lưu. Không tự công bố hay tự tăng thành tích.
- Bài giữ tính theo giây được nhập, lưu, tiếp tục và hoàn thành theo duration; hiệp bỏ qua không bị gán reps giả.
- Receipt mở đúng ngày sinh hoạt hoặc chỉ số cần xem. Trang chia sẻ ẩn header tài khoản.
- `/demo` là hướng dẫn trên tài khoản hiện tại, ghi rõ thao tác lưu là dữ liệu thật của tài khoản đó. Không có workspace demo được seed tự động. Script seed cũ bị vô hiệu hóa để tránh ghi đè dữ liệu người dùng.

## Migration

Production được xác minh đang có 001–008. Dry-run chỉ ra 010–014 cần áp dụng. Migration 014 cài lại các bản sửa policy/function/trigger để nâng cấp cả database đã áp dụng 010–013 trước đó. Không chạy seed hay xóa dữ liệu người dùng khi phát hành.

## Kiểm chứng trước phát hành

- Toàn bộ suite: **29 files, 334/334 tests passed**.
- `npm run build`: **PASS**, gồm lint/typecheck và tất cả route.
- Bộ release regression chạy database Postgres trong RAM (PGlite), có Storage metadata/RLS stub: đọc chéo hồ sơ, quota qua direct API, finalize theo metadata thực, xóa/tải lại bằng grant còn hiệu lực, picker và lưu chứng cứ tương thích, sai run/result ID, preview cũ/bị sửa và hoàn thành bài giữ theo giây.
- Các test cũ được cập nhật fixture để dùng metadata Storage và ExerciseRef hợp lệ; không bỏ/skip các ca thất bại.
- Trình duyệt tự động hiện bị tắt trong Work settings. Không tuyên bố đã kiểm UI tương tác bằng browser; xác minh phát hành qua build, HTTP, CLI Vercel và Supabase.

Tham chiếu thời hạn upload: https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
