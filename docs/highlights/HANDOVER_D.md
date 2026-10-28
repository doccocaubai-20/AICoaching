# BÁO CÁO BÀN GIAO AGENT D: D5 NHÓM NHỎ CÙNG GIỮ CAM KẾT

> **Dự án**: CalisCoaching MVP  
> **Tính năng**: D5 — Nhóm riêng 3–5 người quen cùng giữ cam kết cá nhân và phản hồi động viên  
> **Người thực hiện**: Agent D  
> **Hợp đồng**: Contract G0  
> **Ngày hoàn thành**: 28/10/2026  
> **Trạng thái**: READY — Toàn bộ 34/34 tests kiểm thử tự động PGlite đạt 100%  

---

## 1. Danh sách tệp sở hữu & bàn giao

### 1.1. Migration & Schema Database
- [`supabase/migrations/20261028000013_d5_accountability_groups.sql`](file:///c:/Users/admin/Documents/CalisCoaching/supabase/migrations/20261028000013_d5_accountability_groups.sql):
  - Bảng `groups`: Nhóm cam kết (tên 2-60 ký tự, mô tả, múi giờ cố định, trạng thái `active`/`archived`).
  - Bảng `group_members`: Quản lý thành viên (vai trò `owner`, `admin`, `member`; trạng thái `active`, `left`, `removed`; cờ `is_muted`).
  - Bảng `group_invites`: Lời mời nhóm (lưu mã hash `token_hash` SHA-256, thời hạn TTL, số lượt dùng tối đa `max_uses`, cờ thu hồi `is_revoked`).
  - Bảng `group_commitments`: Cam kết tuần độc lập của từng thành viên (`week_start` theo múi giờ nhóm, `content`, `target_count`, `completed_count`, `status`, `notes`).
  - Bảng `group_reactions`: Phản hồi cảm xúc (`clap` 👏, `fire` 🔥, `muscle` 💪, `heart` ❤️).
  - Bảng `group_feedback_messages`: Lời động viên ngắn (giới hạn 280 ký tự, render text an toàn).
  - Bảng `group_meetups`: Hẹn buổi tập chung (tiêu đề, thời gian, địa điểm, ghi chú, phiên bản `revision`, `revision_note`).
  - Bảng `group_meetup_rsvps`: Xác nhận tham gia (`going`, `maybe`, `declined`, `acknowledged_revision`).
  - Bảng `group_rate_limits`: Chống spam thao tác trên nhiều instance bằng database.
  - Các hàm bảo mật `SECURITY DEFINER` triệt tiêu đệ quy RLS: `is_active_group_member`, `get_group_member_role`, `is_active_member_of_commitment`, `is_active_member_of_meetup`.
  - Trigger ràng buộc: `trg_check_group_capacity` (sức chứa tối đa 5 người), `trg_check_role_integrity` (chống tự nâng role, chống hạ quyền owner).
  - Các RPC nguyên tử: `create_group_with_owner`, `create_group_invite`, `get_group_invite_preview`, `accept_group_invite` (kèm lock `FOR UPDATE`), `leave_group`, `transfer_group_ownership`, `archive_group`, `get_group_member_profiles`, `update_group_meetup`.

### 1.2. Hợp đồng & Kiểu dữ liệu (Contracts)
- [`src/contracts/group.contract.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/contracts/group.contract.ts):
  - Định nghĩa thực thể: `GroupEntity`, `GroupMemberEntity`, `GroupInviteEntity`, `GroupInvitePreview`, `GroupCommitmentEntity`, `GroupReactionEntity`, `GroupFeedbackMessageEntity`, `GroupMeetupEntity`, `GroupMeetupRSVPEntity`.
  - Hàm kiểm tra dữ liệu: `validateCreateGroupInput`, `validateCommitmentInput`, `validateFeedbackMessageInput`, `validateMeetupInput`.
  - Tiện ích xuất tóm tắt và deep links: `exportGroupWeekSummary`, `getGroupDeepLink`, `getInviteDeepLink`.
- [`src/contracts/database-d.types.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/contracts/database-d.types.ts): Khai báo fragment Database types độc lập cho Agent D.
- [`src/contracts/database.types.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/contracts/database.types.ts): Đồng bộ các bảng và RPC của nhóm vào cấu trúc Database trung tâm.
- [`src/contracts/index.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/contracts/index.ts): Xuất khẩu hợp đồng `group.contract`.

### 1.3. Server Actions & Tiện ích hàm thuần
- [`src/app/groups/actions.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/groups/actions.ts):
  - `createGroupAction`: Xác thực, kiểm tra rate limit, tạo nhóm kèm owner.
  - `createInviteAction`: Sinh token an toàn `crypto.randomBytes(24)`, tính hash SHA-256 lưu DB, không log token/URL.
  - `getInvitePreviewAction`: GET preview an toàn, chỉ trả metadata công khai, không tự động gia nhập.
  - `acceptInviteAction`: Mutation có khóa `FOR UPDATE`, tuần tự hóa yêu cầu ghế cuối, chặn vượt quá 5 người.
  - `leaveGroupAction`: Rời nhóm với chính sách bảo vệ (Owner phải chuyển quyền hoặc giải tán, không để nhóm vô chủ).
  - `transferOwnershipAction`: Chuyển quyền chủ nhóm cho thành viên khác đang hoạt động.
  - `archiveGroupAction`: Chủ nhóm xác nhận giải tán/lưu trữ nhóm.
  - `toggleGroupMuteAction`: Bật/tắt thông báo badge trong app (không đổi membership).
  - `saveCommitmentAction`: Đặt/chỉnh sửa cam kết tuần cá nhân.
  - `updateCommitmentStatusAction`: Cập nhật trạng thái và tiến độ hoàn thành một phần.
  - `toggleReactionAction`: Thả / gỡ reaction.
  - `addFeedbackMessageAction`: Gửi tin nhắn ngắn động viên (làm sạch thẻ HTML).
  - `createMeetupAction` & `updateMeetupAction`: Tạo và cập nhật buổi hẹn chung (tự động tăng revision).
  - `rsvpMeetupAction`: Xác nhận tham gia kèm ghi nhận revision đã xem.
- [`src/components/groups/group-utils.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/group-utils.ts):
  - `getWeekStartForDate`: Tính ngày Thứ Hai đầu tuần theo múi giờ nhóm (không dùng UTC date làm ngày địa phương).
  - `getShiftedWeekStart`: Dịch chuyển tuần an toàn.
  - `formatWeekRangeVN`: Hiển thị "26/10 - 01/11/2026".
  - `sanitizeTextMessage`: Xóa thẻ HTML, giới hạn 280 ký tự.
  - Định dạng nhãn và kiểu badge tiếng Việt (`getRoleBadgeStyle`, `getCommitmentStatusBadgeStyle`, `getRSVPBadgeStyle`).

### 1.4. Giao diện người dùng (UI Components & Routes)
- Routes App Router:
  - [`src/app/groups/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/groups/page.tsx): Trang danh sách nhóm của tôi, nút tạo nhóm mới, xử lý khi chưa cấu hình credentials.
  - [`src/app/groups/[groupId]/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/groups/[groupId]/page.tsx): Trang chi tiết nhóm (3 tab: Cam kết tuần, Lịch hẹn, Thành viên).
  - [`src/app/groups/invite/[token]/page.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/app/groups/invite/[token]/page.tsx): Trang xem trước lời mời độc lập và chấp thuận gia nhập.
- UI Components:
  - [`src/components/groups/GroupsManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupsManager.tsx): Điều phối màn hình danh sách nhóm.
  - [`src/components/groups/GroupCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupCard.tsx): Card từng nhóm kèm số thành viên (X/5) và role.
  - [`src/components/groups/GroupDetailManager.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupDetailManager.tsx): Điều phối 3 tab trong nhóm.
  - [`src/components/groups/WeeklyCommitmentsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/WeeklyCommitmentsSection.tsx): Điều hướng tuần, hiển thị cam kết độc lập của từng thành viên, nút cập nhật tiến độ, thanh thả reaction và tin nhắn ngắn.
  - [`src/components/groups/CommitmentFormModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/CommitmentFormModal.tsx): Modal đặt/sửa cam kết cá nhân.
  - [`src/components/groups/GroupMeetupsSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupMeetupsSection.tsx): Lịch hẹn chung, phát hiện lịch đã sửa đổi (Revision) và nhắc xác nhận lại RSVP.
  - [`src/components/groups/MeetupFormModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/MeetupFormModal.tsx): Modal tạo/sửa lịch hẹn lưu revision note.
  - [`src/components/groups/GroupMembersSection.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupMembersSection.tsx): Quản lý thành viên, bật/tắt mute, rời nhóm.
  - [`src/components/groups/InviteMemberModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/InviteMemberModal.tsx): Modal sinh liên kết mời (chọn TTL, max uses, copy link).
  - [`src/components/groups/TransferOrArchiveModal.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/TransferOrArchiveModal.tsx): Modal tuân thủ chính sách Owner rời nhóm.
  - [`src/components/groups/GroupInvitePreviewCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupInvitePreviewCard.tsx): Card xem trước lời mời an toàn.
  - [`src/components/groups/GroupWeekSummaryCard.tsx`](file:///c:/Users/admin/Documents/CalisCoaching/src/components/groups/GroupWeekSummaryCard.tsx): Card tóm tắt cam kết tuần cắm vào Dashboard/Tổng quan.

### 1.5. Bộ kiểm thử tự động
- [`src/tests/agent-d-groups.test.ts`](file:///c:/Users/admin/Documents/CalisCoaching/src/tests/agent-d-groups.test.ts): Bộ kiểm thử 34 test cases toàn diện trên Postgres PGlite.

---

## 2. Chi tiết tuân thủ quy tắc kiến trúc & bảo mật

| Nguyên tắc | Hiện thực thực tế | Trạng thái |
|---|---|:---:|
| **Quy mô 1–5 người** | Nhóm bắt đầu từ 1 người và tối đa 5 người. Trigger DB `check_group_capacity` và hàm RPC `accept_group_invite` khóa hàng `FOR UPDATE` bảo vệ tuyệt đối không bao giờ vượt quá 5 người kể cả khi có 2 yêu cầu đồng thời cho ghế cuối. | **ĐẠT** |
| **Phân quyền Contract G0** | 3 vai trò: `owner`, `admin`, `member`. Trigger DB `check_role_integrity` ngăn chặn thành viên tự nâng quyền và ngăn sửa quyền của Owner. | **ĐẠT** |
| **Chính sách Owner rời nhóm** | Chủ nhóm rời nhóm khi còn thành viên khác bắt buộc phải chuyển quyền (`transfer_group_ownership`) hoặc giải tán có xác nhận (`archive_group`). Nhóm không bao giờ bị rơi vào trạng thái vô chủ. Khi là thành viên duy nhất, rời nhóm sẽ tự động chuyển nhóm sang `archived`. | **ĐẠT** |
| **Lời mời an toàn** | Token ngẫu nhiên (24 bytes base64url), database chỉ lưu SHA-256 hash. Có TTL, cờ thu hồi, giới hạn số lượt dùng. Không đưa token/URL vào logs/analytics. Rate limit DB chống spam. | **ĐẠT** |
| **GET Preview an toàn** | RPC `get_group_invite_preview` chỉ trả thông tin định danh tối thiểu của nhóm và người mời; không tự động gia nhập; không làm lộ danh sách cam kết riêng trước khi chấp thuận. | **ĐẠT** |
| **Tính tuần theo Timezone** | Chốt múi giờ khi tạo nhóm (mặc định `Asia/Ho_Chi_Minh`). Hàm thuần `getWeekStartForDate` tính ngày Thứ Hai đầu tuần theo múi giờ địa phương, không dùng UTC date cắt chuỗi. | **ĐẠT** |
| **Cam kết độc lập** | 4 trạng thái: Dự định / Đã hoàn thành / Dời lịch / Cần đồng hành. Hỗ trợ tiến độ một phần (`completed_count`/`target_count`). Mục tiêu hiển thị riêng rẽ cho từng người. Không có bảng xếp hạng reps/cân nặng/sức khỏe. | **ĐẠT** |
| **Phản hồi nhẹ & an toàn** | 4 reaction (👏, 🔥, 💪, ❤️). Tin nhắn động viên tối đa 280 ký tự, lọc bỏ toàn bộ HTML tag trước khi render để chống XSS. | **ĐẠT** |
| **Hẹn buổi chung & Revision** | Có thời gian, địa điểm, ghi chú và RSVP. Sửa lịch hẹn tự động tăng `revision` và lưu `revision_note`. Người tham gia nhìn thấy cảnh báo lịch đổi và có nút xác nhận lại. Không tự động ghi buổi tập vào nhật ký cá nhân. | **ĐẠT** |
| **Cô lập dữ liệu y tế/cá nhân** | Nhóm chỉ truy cập cam kết, lịch hẹn và phản hồi chủ động công bố. Tuyệt đối không đọc hồ sơ y tế, body metrics, nhật ký chi tiết, nguồn AI hay video. Khi rời nhóm, thành viên mất quyền server ngay lập tức; cam kết cũ của họ được ẩn khỏi nhóm; dữ liệu riêng không bị mất. | **ĐẠT** |
| **Mute thông báo** | Cờ `is_muted` trong `group_members` tắt badge thông báo trong app mà không ảnh hưởng quyền thành viên hay dữ liệu cá nhân. | **ĐẠT** |

---

## 3. Hướng dẫn chạy thử nghiệm & Demo với 2 tài khoản không dùng dữ liệu sức khỏe thật

### Kịch bản Demo: Tài khoản A (Huy Lê) và Tài khoản B (Tuấn)

1. **Bước 1: Tài khoản A tạo nhóm**
   - Đăng nhập tài khoản A, truy cập đường dẫn `/groups`.
   - Bấm nút **"Tạo nhóm mới"**.
   - Nhập tên: `"Nhóm Calisthenics Kỷ Luật"`, mô tả: `"Cùng tập đều 3 buổi/tuần và động viên nhau"`, múi giờ: `"Asia/Ho_Chi_Minh"`.
   - Bấm **"Tạo nhóm"** → Hệ thống chuyển vào `/groups/[groupId]`. A là Chủ nhóm (Owner), số thành viên: 1/5.

2. **Bước 2: A tạo liên kết mời**
   - Tại trang nhóm, bấm **"Mời bạn bè"** (hoặc tab Thành viên → **"Mời thêm"**).
   - Chọn thời hạn: 7 ngày, số lượt dùng: 1 lượt.
   - Bấm **"Tạo liên kết mời"** → Hệ thống tạo token ngẫu nhiên, lưu hash SHA-256 và hiển thị link: `/groups/invite/<token>`.
   - Bấm **"Sao chép"**.

3. **Bước 3: Tài khoản B xem trước (Preview) an toàn**
   - Mở cửa sổ trình duyệt ẩn danh hoặc đăng nhập bằng Tài khoản B.
   - Dán liên kết `/groups/invite/<token>`.
   - Màn hình hiển thị xem trước: Tên nhóm, mô tả, múi giờ, người mời (Huy Lê), số thành viên hiện tại: 1/5.
   - *Chứng minh*: B chưa hề gia nhập nhóm, không thấy bất kỳ cam kết cá nhân nào của A.

4. **Bước 4: B chấp thuận gia nhập**
   - Bấm nút **"Chấp thuận & Gia nhập nhóm"**.
   - Mutation được thực thi an toàn → Chuyển hướng vào trang nhóm. B trở thành thành viên (Member), số lượng: 2/5.

5. **Bước 5: Đặt cam kết cá nhân độc lập**
   - **Tài khoản A**: Bấm **"Đặt cam kết tuần"** → Nhập: `"Tập calisthenics 3 buổi (Pull/Push/Core)"`, số lần mục tiêu: `3`, trạng thái: `"Dự định"`.
   - **Tài khoản B**: Bấm **"Đặt cam kết tuần"** → Nhập: `"Chạy bộ 2 buổi và hít đất mỗi sáng"`, số lần mục tiêu: `2`, trạng thái: `"Dự định"`.
   - Cả hai cùng thấy cam kết của nhau trong danh sách độc lập, không có bảng xếp hạng điểm hay so sánh thể lực.

6. **Bước 6: Cập nhật tiến độ & Phản hồi động viên**
   - B bấm **"+1 lần hoàn thành"** → Tiến độ nhảy lên 1/2 lần. Khi hoàn thành 2 lần, chọn trạng thái: `"Đã hoàn thành"`.
   - A thấy B hoàn thành → Bấm thả cảm xúc 🔥 và gõ lời động viên: `"Xuất sắc quá bạn ơi!"`.
   - B tải lại trang → Reaction và lời động viên hiển thị đầy đủ, an toàn.

7. **Bước 7: Hẹn buổi tập chung & Cập nhật Revision**
   - A chuyển sang tab **"Lịch hẹn"** → Bấm **"Hẹn buổi mới"**.
   - Nhập: `"Tập xà công viên Gia Định"`, thời gian: sáng Thứ 7 tuần này, địa điểm: `"Cổng Hoàng Minh Giám"`.
   - B nhìn thấy buổi hẹn → Bấm RSVP **"Tham gia"** (Revision 1).
   - A phát hiện trời mưa → Bấm biểu tượng sửa lịch: Dời giờ sang 7h00 sáng, ghi chú revision: `"Dời sang 7h00 do trời mưa"`.
   - B nhìn thấy thông báo màu vàng: `"Lịch hẹn đã thay đổi: Dời sang 7h00 do trời mưa. Vui lòng xác nhận lại!"` và bấm nút **"Xác nhận lại"** (Revision 2).

8. **Bước 8: Kiểm tra chính sách rời nhóm**
   - A bấm **"Quản lý rời"**: Hệ thống cảnh báo Chủ nhóm không được rời khi chưa chuyển quyền hoặc giải tán.
   - A chọn **"Chuyển quyền chủ nhóm cho thành viên khác"** → Chọn B → B trở thành Owner mới, A rời nhóm thành công mà không làm nhóm vô chủ.

---

## 4. Kết quả kiểm thử tự động (Verification & Test Proof)

Đã chạy kiểm thử tự động với Vitest và Postgres PGlite:

```bash
npm test src/tests/agent-d-groups.test.ts
```

**Kết quả thực tế:**
```text
 ✓ src/tests/agent-d-groups.test.ts (34 tests) 3057ms
 Test Files  1 passed (1)
      Tests  34 passed (34)
```

**Danh mục 34 ca kiểm thử đã vượt qua:**
1. Tính ngày Thứ Hai đầu tuần chính xác theo múi giờ Việt Nam Asia/Ho_Chi_Minh.
2. Dịch chuyển tuần (+1, -1 tuần) chính xác không phụ thuộc đồng hồ hệ thống.
3. Định dạng khoảng ngày trong tuần tiếng Việt chuẩn.
4. Làm sạch tin nhắn an toàn: loại bỏ HTML tag nguy hiểm và giới hạn 280 ký tự.
5. Kiểm tra tính hợp lệ của input nhóm, cam kết, phản hồi và buổi hẹn.
6. Xuất tóm tắt cam kết tuần đúng hợp đồng CONTRACTS mà không lộ dữ liệu sức khỏe.
7. A tạo nhóm mới (1 thành viên ban đầu, role owner).
8. A tạo lời mời có token ngẫu nhiên lưu hash SHA-256 và TTL.
9. B xem trước (GET preview) an toàn: thấy thông tin nhóm nhưng KHÔNG tự gia nhập.
10. B chấp nhận lời mời (mutation có xác thực): gia nhập thành công thành viên thứ 2.
11. A và B đặt 2 cam kết cá nhân khác nhau cho tuần hiện tại.
12. B cập nhật trạng thái đã làm kèm số lần hoàn thành một phần.
13. A thả reaction 🔥 và gửi lời động viên ngắn cho B, dữ liệu giữ nguyên sau reload.
14. Người ngoài C không đọc được thông tin nhóm qua direct SELECT.
15. Người ngoài C không đọc được cam kết của nhóm qua direct SELECT.
16. Người ngoài C cố tình INSERT cam kết vào nhóm bị RLS từ chối.
17. Token bị thu hồi (revoked) hoặc hết hạn không cho phép chấp nhận gia nhập.
18. Khi member B rời nhóm: mất quyền nội dung nhóm ngay lập tức; cam kết chi tiết ẩn khỏi nhóm.
19. Nhóm hoạt động bình thường với 1 người ban đầu.
20. Các thành viên B, D, E, F lần lượt gia nhập đủ 5 ghế.
21. Người thứ 6 (G) cố gắng gia nhập bị chặn bởi ràng buộc sức chứa tối đa 5 người.
22. Thành viên đã ở trong nhóm (B) accept lặp không nhân đôi membership.
23. Thành viên B không được tự nâng role của chính mình.
24. Thành viên B không được thay đổi quyền của Owner A.
25. Chủ nhóm A rời nhóm khi còn thành viên B bị chặn (không để nhóm vô chủ).
26. Chủ nhóm A chuyển quyền cho B: B thành Owner, A thành Admin, sau đó A rời nhóm thành công.
27. Khi là thành viên duy nhất còn lại, Owner rời nhóm sẽ tự động lưu trữ (archive) nhóm.
28. A tạo lịch hẹn buổi tập chung: revision khởi tạo là 1.
29. B xác nhận tham gia (RSVP going) với acknowledged_revision = 1.
30. A sửa lịch hẹn qua RPC update_group_meetup: revision tự động tăng lên 2.
31. B xác nhận lại tham gia sau khi lịch đổi: acknowledged_revision được cập nhật lên 2.
32. A không thể đọc mục tiêu, chỉ số cân nặng hay hoạt động cá nhân của B.
33. B bật tắt Mute thông báo trong app: không làm mất quyền thành viên.
34. Khi B rời nhóm hoặc tắt mute: dữ liệu nhật ký và mục tiêu cá nhân của B hoàn toàn không bị xóa.

---

## 5. Kết luận & Sẵn sàng bàn giao

- **Migration**: `supabase/migrations/20261028000013_d5_accountability_groups.sql`
- **Tập hợp tệp D**: `src/contracts/group.contract.ts`, `src/contracts/database-d.types.ts`, `src/app/groups/**`, `src/components/groups/**`, `src/tests/agent-d-groups.test.ts`.
- **Không sửa đổi ngoài quyền**: Không sửa BottomNav, Dashboard, Profile, Auth Guard hay Supabase Client Factory.
- **Cam kết an toàn dữ liệu**: Nhóm hoàn toàn độc lập, bảo vệ quyền riêng tư tuyệt đối, không chia sẻ hồ sơ y tế hay dữ liệu cá nhân của người dùng.
