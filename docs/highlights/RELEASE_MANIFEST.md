# TÀI LIỆU CÔNG BỐ PHÁT HÀNH (RELEASE MANIFEST)
## BỘ 6 ĐIỂM NHẤN CALISCOACHING — PHIÊN BẢN TÍCH HỢP TOÀN DIỆN

- **Ngày phát hành:** 28/10/2026
- **Trạng thái:** SẴN SÀNG TRIỂN KHAI NỘI BỘ (READY FOR LOCAL DEPLOYMENT)
- **Base Commit (BASE_SHA):** `56d50f21cdb110744f4f65ca920ed64aa0306ba6`
- **Head Commit:** `1a06a01` (Tích hợp luồng người dùng 5 tab & Dashboard ưu tiên D1-D6)
- **Quy tắc tuân thủ:** Không tự ý chạy migration trên production database; không tự ý git push lên nhánh remote khi chưa có phê duyệt.

---

## 1. DANH MỤC COMMIT TÍCH HỢP (COMMIT CHAIN)

Chuỗi commit thể hiện trọn vẹn tiến trình từ phân nhánh song song tới tích hợp hoàn thiện:

1. `93fd671` — **feat(agent-a):** Hoàn tất D1 Ghi nhanh một câu và D2 Hồ sơ đem đi trao đổi.
2. `3e30719` — **feat(workout):** Agent B - D3 Tiếp tục tập có trí nhớ (persistence, state machine, outbox & RPC).
3. `957f07c` — **feat(groups-d5):** Nhóm nhỏ 3-5 người cùng giữ cam kết theo Contract G0.
4. `d2f41a0` — **feat(skills-journey):** Agent C - D4 Hành trình kỹ năng có bằng chứng và D6 Video đối chiếu.
5. `b4293fb` — **chore(coordinator):** Harmonize database types and contracts across all 4 agents.
6. `c53e83f` — **docs(agent-c):** Cập nhật đầy đủ biên bản bàn giao kỹ thuật Agent C.
7. `1a06a01` — **feat(integration):** Tích hợp luồng người dùng 5 tab bottom nav, Dashboard ưu tiên D1-D6 và Programs nối Journey.

---

## 2. THỨ TỰ ÁP DỤNG CƠ SỞ DỮ LIỆU (FROZEN MIGRATION SEQUENCE)

Thứ tự migration đã được khóa số phiên bản, đảm bảo không có sự phụ thuộc vòng chéo giữa các bảng:

| Thứ tự | Tên tệp Migration | Agent | Bảng / RPC chính được tạo |
|---|---|---|---|
| **1** | `20261028000010_agent_a_capture_briefs.sql` | **Agent A** | `capture_drafts`, `shareable_briefs`, `brief_snapshots`, hàm `create_shareable_brief_snapshot`, hàm `revoke_shareable_brief`. |
| **2** | `20261028000011_agent_b_workout_runs.sql` | **Agent B** | `workout_runs`, `workout_run_sets`, các RPC `start_workout_run`, `update_workout_run_progress`, `finish_workout_run`. |
| **3** | `20261028000012_agent_c_skills_journey_media.sql` | **Agent C** | `skill_journeys`, `skill_milestones`, `journey_videos`, `journey_attempts`, bucket `comparison_videos`, các RPC `reserve_journey_video_upload`, `finalize_journey_video_upload`, `mark_journey_video_for_deletion`, trigger invalidation. |
| **4** | `20261028000013_d5_accountability_groups.sql` | **Agent D** | `groups`, `group_members`, `group_invites`, `weekly_commitments`, `commitment_reactions`, `commitment_feedback`, `group_meetups`, `meetup_rsvps`. |

> [!IMPORTANT]
> **Nguyên tắc Migration:**
> Áp dụng tuần tự từ `10` đến `13`. Tất cả các bảng đều bật sẵn Row Level Security (RLS) với policy chặt chẽ, cô lập hoàn toàn dữ liệu giữa các người dùng.

---

## 3. CHIẾN LƯỢC QUẢN LÝ RỦI RO & HOÀN NGUYÊN (ROLLBACK & FORWARD-FIX)

Khi triển khai trên môi trường production trong tương lai, tuân thủ nghiêm ngặt các nguyên tắc sau:

1. **Tuyệt đối không DROP TABLE:**
   - Không thực hiện rollback bằng cách xóa bỏ bảng mới (`DROP TABLE`) nếu bảng đó đã phát sinh dữ liệu của người dùng thật.
2. **Tách biệt Rollback Mã nguồn vs Database:**
   - **Rollback Code:** Sử dụng Git tag hoặc revert commit ứng dụng về mốc `BASE_SHA` (`56d50f21cdb110744f4f65ca920ed64aa0306ba6`).
   - **Tắt tính năng (Feature Flags):** Điều phối các cờ hiển thị giao diện để ẩn lối vào tính năng mới mà không can thiệp schema DB.
   - **Forward-Fix Database:** Khi phát sinh lỗi schema, viết migration mới tăng dần (ví dụ `20261028000014_fix_...`) để sửa đổi cấu trúc hoặc bổ sung index, không ghi đè hoặc xóa lùi migration cũ.

---

## 4. PHẠM VI GIỚI HẠN VÀ CÁC NỘI DUNG HOÃN LẠI (DEFERRED ITEMS)

Theo đúng quy định của Plan gốc, các tính năng sau **chưa thuộc phạm vi** của đợt bàn giao này:
- ❌ **Ghi âm giọng nói (Voice Audio STT):** D1 hiện chỉ hỗ trợ nhập liệu văn bản tự nhiên có phân tích cú pháp tiếng Việt; không đưa nút microphone giả lập chưa hoàn thiện vào giao diện.
- ❌ **Xuất tệp PDF in ấn (Published PDF Exports):** D2 tập trung hoàn thiện snapshot tĩnh trên web và chia sẻ link bí mật kèm mã QR; tính năng xuất file PDF phức tạp được hoãn sang giai đoạn sau.
- ❌ **AI phân tích form chuyển động qua camera (AI Computer Vision):** D6 cung cấp trình phát so sánh video song song 2 clip với điều khiển đồng bộ và chỉnh tốc độ trực quan cho mắt người; không khẳng định hay hứa hẹn tính năng AI tự động chấm điểm form.
- ❌ **Mạng xã hội công khai & Bảng xếp hạng điểm số (Public Social Feed & Leaderboards):** D5 giới hạn nghiêm ngặt trong nhóm nhỏ 3–5 người thân quen giữ cam kết riêng tư, loại bỏ hoàn toàn các yếu tố gây áp lực tâm lý hay so đo thành tích.

---

## 5. BẰNG CHỨNG XÁC MINH TOÀN VẸN (VERIFICATION STATUS)

| Hạng mục kiểm tra | Lệnh thực hiện | Kết quả thực tế | Trạng thái |
|---|---|---|---|
| **TypeScript Typecheck** | `npx tsc --noEmit` | Exit code 0, 0 lỗi biên dịch trên toàn codebase | ✅ ĐẠT |
| **Test Suite Tự Động** | `npm test` | 27 test files, **311/311 tests passed**, thời gian chạy 20.91s | ✅ ĐẠT |
| **Next.js Production Build** | `npm run build` | Compile thành công 26 routes (Dynamic server-rendered), 0 cảnh báo nghiêm trọng | ✅ ĐẠT |
| **Kiểm tra RLS & Cô lập dữ liệu** | Suite tests Agent B, C, D | User B không thể truy cập, sửa đổi hay đọc trộm phiên tập, video hay hồ sơ của User A | ✅ ĐẠT |
| **Kiểm tra Hạn mức Quota** | `agent-c-journey-media.test.ts` | Chặn tệp > 20 MiB, chặn tổng dung lượng tài khoản > 100 MiB bằng DB lock | ✅ ĐẠT |
| **Kiểm tra Invalidation Triggers** | `agent-c-journey-media.test.ts` | Sửa/xóa hoạt động nền tự động chuyển mốc kỹ năng sang `needs_review` | ✅ ĐẠT |
| **Kiểm tra Thu hồi Snapshot** | `agent-a-briefs.test.ts` | Thu hồi link lập tức chặn truy cập từ phía người nhận | ✅ ĐẠT |

---

## 6. HƯỚNG DẪN MỞ VÀ VẬN HÀNH ỨNG DỤNG LOCAL

Để khởi chạy và trải nghiệm sản phẩm tại máy phát triển:

```bash
# 1. Cài đặt các gói phụ thuộc (nếu chưa có)
npm install

# 2. Khởi động môi trường Next.js Development Server
npm run dev
```

Truy cập trình duyệt tại địa chỉ: `http://localhost:3000`
- **Hôm nay (Dashboard):** `http://localhost:3000/dashboard`
- **Ghi nhanh 1 câu:** `http://localhost:3000/capture`
- **Tập luyện & Live Workout:** `http://localhost:3000/programs` và `http://localhost:3000/workout`
- **Hành trình kỹ năng:** `http://localhost:3000/journey`
- **Phòng đối chiếu video:** `http://localhost:3000/journey/compare`
- **Nhóm cam kết đồng hành:** `http://localhost:3000/groups`
- **Bản tóm tắt chia sẻ:** `http://localhost:3000/briefs`
