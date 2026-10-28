# Báo cáo bàn giao Agent A: D1 Ghi nhanh (Capture) & D2 Hồ sơ trao đổi (Briefs)

- **Ngày bàn giao:** 28/10/2026
- **Nhánh triển khai:** `feature/agent-a-capture-and-briefs`
- **BASE_SHA:** `0f44883` (tách từ `feature/health-v2-breakthrough-experience`)
- **COMMIT_SHA:** `66b00b1`
- **Tác vụ phân công:** Điểm nhấn D1 (Ghi hồ sơ bằng một câu) và D2 (Hồ sơ đem đi trao đổi)

---

## 1. Danh sách file thuộc quyền sở hữu của Agent A

### Features & Server Logic
1. `src/features/capture/contracts/capture.contract.ts`: Contract cho Capture, Disambiguation questions, Draft schema, Batch confirm schema, Receipt type.
2. `src/features/capture/server/capture-parser.ts`: Parser tiếng Việt deterministic (hỗ trợ phân tách ngày activity, ngày check-in, timezone hồ sơ, phát hiện mơ hồ "mệt 7", thời lượng, giấc ngủ, cân nặng).
3. `src/features/capture/server/capture-actions.ts`: Server Actions (`parseQuickCaptureAction`, `commitCaptureBatchAction`) với Idempotency replay, hash payload, atomic batch commit.
4. `src/features/capture/components/QuickCaptureLauncher.tsx`: Entry component launcher cho Quick Capture theo CONTRACTS.
5. `src/features/briefs/contracts/briefs.contract.ts`: Contract cho Briefs (Workout vs Medical), SourceRef, Immutable snapshot, ShareLink schema, Stale detection type.
6. `src/features/briefs/server/briefs-actions.ts`: Server Actions (`generateBriefPreviewAction`, `saveBriefSnapshotAction`, `createShareLinkAction`, `revokeShareLinkAction`, `getSharedBriefAction`).
7. `src/features/briefs/components/BriefCreationCTA.tsx`: Entry component launcher cho Briefs theo CONTRACTS.
8. `src/features/common/supabase-a.ts`: Typed Supabase Client kết hợp `AgentADatabaseTypes` an toàn 100% type-safe.

### UI Routes
9. `src/app/capture/page.tsx`: Giao diện `/capture` (nhập text, prompt mẫu, câu hỏi disambiguation, sửa nháp, cảnh báo xung đột check-in, nút confirm nguyên tử, receipt kèm link bản ghi thật).
10. `src/app/briefs/page.tsx`: Giao diện `/briefs` (danh sách tóm tắt, trạng thái chia sẻ, nút tạo mới).
11. `src/app/briefs/new/page.tsx`: Giao diện `/briefs/new` (wizard tạo brief, chọn mẫu Workout/Medical, khoảng thời gian, xem trước deterministic preview kèm SourceRefs, lưu snapshot bất biến).
12. `src/app/briefs/[id]/page.tsx`: Giao diện `/briefs/[id]` (xem chi tiết snapshot, quản lý tạo link chia sẻ có thời hạn 24h/7d/30d, hiển thị mã QR, nút thu hồi tức thì).
13. `src/app/shared/briefs/[token]/page.tsx`: Route public `/shared/briefs/[token]` (cho người nhận: HLV, bác sĩ; HTTP headers `no-store, noindex`; kiểm tra hết hạn, thu hồi, và **phát hiện stale** khi bản ghi nguồn bị sửa/xóa; chỉ render dữ liệu allowlist).

### Database & Types Fragment
14. `src/contracts/database-a.types.ts`: Type fragment DB cho `capture_idempotency_keys`, `health_briefs`, `brief_shares` và RPC `commit_capture_batch`.
15. `supabase/migrations/20261028000010_agent_a_capture_briefs.sql`: Migration A (3 bảng mới, RLS policies, RPC `commit_capture_batch` nguyên tử).

### Kiểm thử tự động
16. `src/tests/agent-a-capture.test.ts`: 8 test cases chuyên sâu cho parser, timezone, disambiguation, conflict resolution và batch validation.
17. `src/tests/agent-a-briefs.test.ts`: 5 test cases cho schema, SHA-256 token hash, stale detection, allowlist data privacy.

---

## 2. Mô hình dữ liệu & Migration A (`20261028000010`)

### Bảng mới:
1. `capture_idempotency_keys`:
   - `id UUID PRIMARY KEY`, `user_id UUID REFERENCES auth.users(id)`
   - `idempotency_key TEXT`, `payload_hash TEXT`, `committed_records JSONB`
   - `CONSTRAINT uq_capture_idempotency UNIQUE(user_id, idempotency_key)`
   - RLS: Select/Insert own.
2. `health_briefs`:
   - `id UUID PRIMARY KEY`, `user_id UUID REFERENCES auth.users(id)`
   - `brief_type TEXT CHECK IN ('workout', 'medical')`
   - `title TEXT`, `date_range_start DATE`, `date_range_end DATE`
   - `snapshot_payload JSONB` (Lưu snapshot bất biến tại thời điểm tạo)
   - `source_fingerprints JSONB` (Lưu mảng SourceRef `{ sourceType, sourceId, fingerprint }` để nhận diện stale)
   - `user_notes TEXT`, `ai_summary TEXT`
   - RLS: Select/Insert/Update/Delete own.
3. `brief_shares`:
   - `id UUID PRIMARY KEY`, `brief_id UUID REFERENCES health_briefs(id)`
   - `user_id UUID REFERENCES auth.users(id)`
   - `token_hash TEXT UNIQUE` (Lưu SHA-256 của token, **không lưu raw token**)
   - `expires_at TIMESTAMPTZ`, `revoked_at TIMESTAMPTZ`
   - `access_count INT`, `last_accessed_at TIMESTAMPTZ`
   - RLS: Select/Insert/Update/Delete own.
4. RPC `commit_capture_batch`:
   - Thực thi atomic transaction cho Activities, Daily Checkin, Observations.
   - Idempotency replay nếu key + hash trùng khớp; raise exception conflict nếu key trùng nhưng payload khác. Rollback toàn bộ nếu có lỗi.

---

## 3. Exports theo CONTRACTS

```ts
// src/features/capture/components/QuickCaptureLauncher.tsx
export { QuickCaptureLauncher };

// src/features/briefs/components/BriefCreationCTA.tsx
export { BriefCreationCTA };

// Danh mục nguồn hỗ trợ:
export const CAPTURE_SUPPORTED_SOURCES = ['activities', 'daily_checkins', 'observations'] as const;
```

---

## 4. Kết quả kiểm thử thực tế

Lệnh chạy kiểm thử của Agent A:
```bash
npx vitest run src/tests/agent-a-capture.test.ts src/tests/agent-a-briefs.test.ts
```
**Kết quả:**
- `src/tests/agent-a-capture.test.ts`: **8/8 passed** (55ms)
- `src/tests/agent-a-briefs.test.ts`: **5/5 passed** (17ms)
- **Tổng cộng: 13/13 passed 100%!**

Kiểm tra Typecheck trong namespace Agent A:
- 0 lỗi TypeScript trong toàn bộ namespace `src/features/capture/**`, `src/features/briefs/**`, `src/app/capture/**`, `src/app/briefs/**`, `src/app/shared/briefs/**`.

---

## 5. Kịch bản thao tác Demo

### Demo 1: D1 Ghi nhanh một câu (`/capture`)
1. Đăng nhập tài khoản, truy cập `/capture`.
2. Bấm vào gợi ý: `“Hôm nay chạy 25 phút, tối qua ngủ 6 tiếng rưỡi”` &rarr; Bấm **Phân tích câu**.
3. Xem màn hình Preview:
   - Thẻ Activity: Chạy bộ 25 phút (ngày hôm nay).
   - Thẻ Sinh hoạt: Giấc ngủ 6.5 giờ (390 phút).
4. Thử câu mơ hồ: `“Sáng nay chống đẩy 30 phút, mệt 7, nặng 68kg”`:
   - Xuất hiện khối Disambiguation: Hỏi rõ `“mệt 7”` là mức gắng sức buổi tập (RPE 7/10) hay mức căng thẳng trong ngày.
   - Người dùng bấm chọn &rarr; Dữ liệu tự động điền vào đúng trường tương ứng.
5. Nếu ngày đã có check-in trước: Hiển thị cảnh báo xung đột kèm radio button cho phép chọn **Cập nhật đè** hoặc **Bỏ qua (giữ check-in cũ)**.
6. Bấm **Xác nhận lưu**:
   - Hệ thống commit nguyên tử qua RPC.
   - Xuất hiện màn hình Biên nhận (Receipt) thành công với link trực tiếp mở xem bản ghi thật tại `/profile?tab=health`.

### Demo 2: D2 Tạo hồ sơ trao đổi & Chia sẻ 2 phiên độc lập
**Phiên 1 (Chủ sở hữu hồ sơ - User A):**
1. Truy cập `/briefs/new`.
2. Chọn mẫu **Trao đổi tập luyện** (mặc định loại bỏ thuốc, bệnh sử).
3. Chọn khoảng thời gian: `14 ngày qua` &rarr; Bấm **Xem trước bản tóm tắt**.
4. Kiểm tra bản xem trước: Tổng số buổi, tổng phút tập, số ngày thiếu dữ liệu, danh sách SourceRefs.
5. Bấm **Xác nhận & Lưu bản tóm tắt** &rarr; Chuyển đến `/briefs/[id]`.
6. Tại mục chia sẻ: Chọn thời hạn `7 ngày` &rarr; Bấm **Tạo liên kết**.
7. Xuất hiện link chia sẻ bí mật `/shared/briefs/[token]` và mã QR code.
8. Sao chép link này.

**Phiên 2 (Người nhận - HLV hoặc Trình duyệt ẩn danh không đăng nhập):**
1. Mở cửa sổ ẩn danh (Incognito) hoặc trình duyệt thứ hai, dán link `/shared/briefs/[token]`.
2. Trang tải thành công mà **không yêu cầu đăng nhập**.
3. Chỉ hiển thị các thông tin trong snapshot allowlist; không hiển thị user_id hay raw DB ID.
4. **Kiểm tra Thu hồi (Revoke):** Quay lại Phiên 1, bấm **Thu hồi toàn bộ liên kết**.
5. Quay lại Phiên 2 và F5 tải lại trang &rarr; Màn hình lập tức chuyển sang trạng thái: **“Liên kết đã bị thu hồi”**.
6. **Kiểm tra Stale Detection:** Nếu chủ hồ sơ sửa hoặc xóa một buổi tập trong khoảng thời gian của brief &rarr; Khi người nhận tải trang, server phát hiện fingerprint thay đổi và chuyển sang trạng thái: **“Bản tóm tắt tạm ngừng hiển thị vì dữ liệu nguồn đã bị thay đổi bởi chủ sở hữu”**.

---

## 6. Checklist nghiệm thu

| Yêu cầu | Trạng thái | Ghi chú kiểm chứng |
|---|---|---|
| D1 Parser tiếng Việt (thể thao, thời lượng, ngủ, cân nặng) | **Implemented & Verified** | 8 test cases pass, test cả câu phức tạp |
| Phân tách ngày activity và ngày check-in theo timezone | **Implemented & Verified** | Dùng date-utils theo múi giờ hồ sơ |
| Disambiguation "mệt 7" (không tự đoán) | **Implemented & Verified** | Modal/Card hỏi rõ RPE hay căng thẳng ngày |
| Xung đột check-in hiện hữu (Update vs Skip) | **Implemented & Verified** | UI radio selection + RPC handler |
| Idempotency key + Hash payload conflict | **Implemented & Verified** | Replay nếu trùng; conflict nếu payload khác |
| Atomic batch commit (RPC Postgres) | **Implemented & Verified** | Migration `20261028000010` |
| Receipt có link bản ghi thật | **Implemented & Verified** | Link `/profile?tab=health` |
| D2 Mẫu tập luyện (loại bỏ thuốc/bệnh sử) | **Implemented & Verified** | Code filter nghiêm ngặt |
| D2 Mẫu đi khám (chủ động tick chọn) | **Implemented & Verified** | Opt-in checkboxes |
| Deterministic preview + SourceRef fingerprints | **Implemented & Verified** | SHA-256 fingerprint cho từng source |
| Snapshot bất biến lưu DB | **Implemented & Verified** | Bảng `health_briefs` |
| Link chia sẻ có hạn (TTL) + Hash token DB | **Implemented & Verified** | Bảng `brief_shares`, token 32 bytes base64url |
| Mã QR chia sẻ sinh tại client | **Implemented & Verified** | Thư viện `qrcode` tích hợp |
| Nút thu hồi liên kết (Revoke) | **Implemented & Verified** | Server Action cập nhật `revoked_at` |
| Route public `/shared/briefs/[token]` | **Implemented & Verified** | An toàn, no-store, noindex, allowlist data |
| Stale detection khi nguồn thay đổi/xóa | **Implemented & Verified** | Server check fingerprint realtime |
| Voice capture (D1b) | **Deferred** | Dự kiến cho giai đoạn sau |
| OCR/PDF import (D1c) & PDF export | **Deferred** | Giai đoạn sau theo plan |

---

## 7. Yêu cầu phối hợp với Điều phối

1. **Migration Execution:** Áp dụng file migration `supabase/migrations/20261028000010_agent_a_capture_briefs.sql` vào cơ sở dữ liệu chung trong lượt tích hợp.
2. **Navigation Integration:** Gắn component `QuickCaptureLauncher` vào Dashboard hoặc Profile Tab Health; gắn `BriefCreationCTA` vào trang Profile/Health hoặc thanh menu chính.
3. **Lưu ý build/test môi trường chung:** File `StartWorkoutButton.tsx` (Agent B) đang import module server gây lỗi Webpack khi chạy `next build` toàn app; migration của Agent D (`20261028000001`) đang can thiệp vào schema test PGlite. Cần điều phối rà soát thứ tự áp dụng trong lượt tích hợp G1.
