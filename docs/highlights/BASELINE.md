# BASELINE — Nền tảng G0 CalisCoaching (4 Agent Song Song)

Ngày lập: 28/10/2026  
Trạng thái: **READY**  
BASE_SHA: `56d50f21cdb110744f4f65ca920ed64aa0306ba6` (gốc trước các nhánh feature A/B/C/D)

---

## 1. Nguồn Checkout & Trạng thái Schema

- **Môi trường:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth, Postgres, Storage).
- **Trạng thái kiểm thử nền:** 217/217 tests passed across 20 test suites (100% pass tuần tự bằng Vitest + PGlite).
- **Danh sách Migrations nền tảng (01 - 08):**
  1. `20261027000001_mvp_schema_and_rls.sql`: Profiles, Goals, Observations, Activities, Programs, Sessions, Session Results, Review Suggestions, AI Consents, AI Summaries, AI Conversations, AI Messages.
  2. `20261027000002_a_fixes_ownership_idempotency.sql`: Fixes trigger handle_new_user, idempotency key, parent ownership.
  3. `20261027000003_goal_dates_check.sql`: Ràng buộc ngày mục tiêu.
  4. `20261027000004_activity_duration_review_dedupe.sql`: Giới hạn thời lượng hoạt động <= 1440 phút, chặn trùng gợi ý.
  5. `20261027000005_harden_functions.sql`: Khóa search_path, bảo vệ RPC.
  6. `20261027000006_health_profile_v2.sql`: Health Profiles, Vitals, Daily Check-ins, Conditions, Allergies, Medications, Events, Documents.
  7. `20261027000007_health_v2_security_fixes.sql`: Bảo mật RLS Storage và trigger ownership.
  8. `20261027000008_review_fixes.sql`: Khóa pg_advisory_xact_lock chống race condition quota document, Athlete Passport Share snapshot.

---

## 2. Phân vùng Độc lập (Ownership 4 Agent)

| Agent | Tính năng | Phạm vi mã nguồn | Migration | DB Fragment |
|---|---|---|---|---|
| **A** | D1 Ghi nhanh + D2 Bản tóm tắt | `src/features/capture/**`, `src/features/briefs/**`, `src/app/capture/**`, `src/app/briefs/**` | `20261028000010_...` | `database-a.types.ts` |
| **B** | D3 Tiếp tục tập có trí nhớ | `src/features/workout/**`, `src/app/workout/**` | `20261028000011_...` | `database-b.types.ts` |
| **C** | D4 Hành trình kỹ năng + D6 Video đối chiếu | `src/features/skills/**`, `src/features/media/**`, `src/app/journey/**` | `20261028000012_agent_c_skills_journey_media.sql` | `database-c.types.ts` |
| **D** | D5 Nhóm nhỏ giữ cam kết | `src/features/groups/**`, `src/app/groups/**` | `20261028000013_...` | `database-d.types.ts` |
| **Điều phối** | Shell, layout, navigation, tổng hợp | `src/app/layout.tsx`, `BottomNav.tsx`, `Dashboard`, `database.types.ts` | `20261028000009_...` (nếu có) | Hợp nhất trung tâm |

---

## 3. Lệnh kiểm tra đang dùng

- Kiểm thử tự động: `npm test` hoặc `npx vitest run --fileParallelism=false`
- Kiểm tra kiểu dữ liệu: `npx tsc --noEmit`
- Kiểm tra đóng gói build: `npm run build`
