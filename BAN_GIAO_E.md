# BÁO CÁO BÀN GIAO AGENT E - HỆ THỐNG AI TƯƠNG TÁC (TÓM TẮT, HỎI ĐÁP & XU HƯỚNG)

**Dự án:** CalisCoaching MVP  
**Phụ trách:** Agent E  
**Ngày cập nhật:** 27/10/2026  
**Trạng thái kiểm thử:** 117/117 tests passed across 8 test suites (29 tests riêng của Agent E)  
**Biên dịch & Build:** `npx tsc --noEmit` đạt 0 lỗi; `npm run build` thành công (Route `/ai` 9.71 kB)  

---

## 1. Báo cáo khắc phục toàn diện các phát hiện rà soát (S1–S3, E1–E10)

Báo cáo rà soát độc lập ngày 27/10/2026 và bộ harness `review-e-probes.cjs` đã chỉ ra 13 điểm cần khắc phục. Toàn bộ các phát hiện đã được phân tích, sửa đổi mã nguồn và bổ sung bộ regression test tương ứng trong `src/tests/agent-e-ai.test.ts`:

### S1: Rò rỉ dữ liệu dẫn xuất khi thu hẹp Scope (Derived Data Scope)
- **Vấn đề:** Gợi ý xem lại lịch `review_suggestions` vốn được dẫn xuất từ dữ liệu hoạt động tập luyện (`activities`). Khi người dùng chỉ đồng ý chia sẻ mục tiêu (`scope: ['goals']`), gợi ý xem lại lịch và ID hoạt động vẫn bị gửi sang AI context.
- **Cách khắc phục:**
  - Sửa `src/lib/ai/context.ts`: chỉ đưa `review_suggestions` vào payload khi `effectiveScope.includes('activities')`.
  - Đối với các gợi ý hợp lệ, mảng `reference_activity_ids` được lọc qua `allowedRecordIds` để đảm bảo chỉ giữ lại các ID hoạt động nằm trong phạm vi đã đồng ý và nằm trong khoảng thời gian cho phép.
- **Tệp sửa:** `src/lib/ai/context.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `S1`).

### S2: Gửi lại lịch sử hội thoại chứa dữ liệu đã bị rút khỏi Scope (History Scope)
- **Vấn đề:** Khi người dùng thay đổi hoặc thu hẹp scope (ví dụ bỏ chia sẻ `observations`), các lượt đối thoại cũ trong phiên hỏi đáp có nhắc đến số đo thể chất (ví dụ "Synthetic private weight is 65 kg") vẫn bị gửi lại cho mô hình AI trong `messageHistory`.
- **Cách khắc phục:**
  - Cập nhật hàm thuần `buildConversationHistory` trong `src/lib/ai/history.ts`: nhận tham số `scope?: ConsentScopeItem[]`.
  - Phân tích nội dung và `reference_sources` của từng tin nhắn: nếu `scope` thiếu `observations`, loại bỏ tin nhắn chứa từ khóa cân nặng, chiều cao hoặc số đo kg/cm; nếu thiếu `activities`, loại bỏ tin nhắn nhắc đến số buổi tập/môn tập; nếu `scope` rỗng hoặc bị rút quyền, hàm trả về mảng rỗng `[]`.
  - Trong `src/app/ai/actions.ts`: kiểm tra `if (!hasConsent || scope.length === 0)` ngay tại tầng Server Action và dừng sớm, không gọi adapter nếu không có quyền.
- **Tệp sửa:** `src/lib/ai/history.ts`, `src/app/ai/actions.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `S2`).

### S3: Nội dung xin đồng ý chưa minh bạch với dữ liệu thực tế (Consent Disclosure)
- **Vấn đề:** Giao diện xin đồng ý trước đây chỉ ghi chung chung "môn tập, thời lượng, mức mệt và mục tiêu", trong khi thực tế quyền mặc định bao gồm 4 nhóm: profile, goals, activities, observations, đồng thời câu hỏi và ghi chú tự nhập được gửi nguyên văn.
- **Cách khắc phục:**
  - Viết lại phần thuyết minh trong `src/components/ai/AIConsentBanner.tsx`: liệt kê đầy đủ 4 nhóm dữ liệu rèn luyện thực tế: (1) Hồ sơ & mục tiêu rèn luyện; (2) Hoạt động rèn luyện và ghi chú tự nhập; (3) Chỉ số quan sát thể chất (chiều cao, cân nặng tự đo); (4) Câu hỏi và lịch sử trao đổi đa lượt.
  - Thêm cảnh báo nổi bật: *"Nội dung câu hỏi và ghi chú do bạn tự nhập sẽ được gửi nguyên văn đến nhà cung cấp AI. Vui lòng không nhập họ tên thật, email, số điện thoại, mật khẩu hay thông tin bệnh án nhạy cảm vào các ô nhập liệu."*
  - Hiển thị tên nhà cung cấp động (`providerName`) và trích dẫn chuẩn chính sách Google Cloud Paid Tier: cam kết không lưu giữ dữ liệu để huấn luyện mô hình.
- **Tệp sửa:** `src/components/ai/AIConsentBanner.tsx`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `S3`).

### E1: Nút thử lại gửi câu thông báo lỗi thay vì câu hỏi gốc của người dùng (UI Retry)
- **Vấn đề:** Trong `AIChatBox.tsx`, khi tin nhắn của trợ lý ở trạng thái `failed`, nút "Thử lại câu hỏi" gọi `handleRetry(msg.content)` với `msg` là tin nhắn lỗi của trợ lý, dẫn đến việc gửi chuỗi thông báo lỗi làm câu hỏi mới.
- **Cách khắc phục:**
  - Trong `src/components/ai/AIChatBox.tsx`: khi nhấn nút thử lại trên tin nhắn lỗi của trợ lý, thuật toán tìm ngược lại tin nhắn người dùng gần nhất đứng trước nó:
    ```tsx
    const precedingUserMsg = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === 'user');
    handleRetry(precedingUserMsg?.content || '');
    ```
- **Tệp sửa:** `src/components/ai/AIChatBox.tsx`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E1`).

### E2: Lỗi truy vấn cơ sở dữ liệu bị chuyển thành trạng thái rỗng ngầm định (Page Error Handling)
- **Vấn đề:** Trong `src/app/ai/page.tsx`, nếu các truy vấn Supabase (`ai_summaries`, `ai_messages`, `ai_conversations`) phát sinh lỗi, trang chuyển `null` hoặc `[]` xuống `AIManager`, khiến giao diện hiển thị trạng thái "Chưa có bản tóm tắt nào" hoặc "Chưa có tin nhắn nào" thay vì báo lỗi truy vấn.
- **Cách khắc phục:**
  - Sửa `src/app/ai/page.tsx`: thu thập lỗi truy vấn vào biến `loadError: string | null`. Nếu có bất kỳ lỗi truy vấn dữ liệu nào, gán thông báo lỗi rõ ràng.
  - Sửa `src/components/ai/AIManager.tsx`: nhận prop `loadError`, hiển thị banner cảnh báo lỗi truy vấn ở đầu trang, và truyền `loadError` xuống `AISummaryCard`, `AITrendCard` để không hiển thị thông báo rỗng giả.
- **Tệp sửa:** `src/app/ai/page.tsx`, `src/components/ai/AIManager.tsx`, `src/components/ai/AISummaryCard.tsx`, `src/components/ai/AITrendCard.tsx`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E2`).

### E3: Thiếu cận trên cho cửa sổ thời gian truy vấn (Time Window Boundaries)
- **Vấn đề:** Truy vấn chỉ lọc `.gte('start_at', dateFrom)` mà không chặn cận trên `.lte('start_at', dateTo)`, dẫn đến việc các hoạt động trong tương lai hoặc ngoài chu kỳ có thể bị tính vào ngữ cảnh phân tích.
- **Cách khắc phục:**
  - Sửa các truy vấn trong `generateAISummaryAction`, `askAIQuestionAction` và `analyzeProfileTrendsAction` trong `src/app/ai/actions.ts`: bổ sung đồng thời `.lte('start_at', dateTo)` và `.lte('observed_at', dateTo)`.
  - Trong `src/lib/ai/context.ts` và `src/lib/ai/trend-analysis.ts`: lọc chặt chẽ cả 2 đầu thời gian `t >= fromTime && t <= toTime`.
- **Tệp sửa:** `src/app/ai/actions.ts`, `src/lib/ai/context.ts`, `src/lib/ai/trend-analysis.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E3`).

### E4: Bổ sung 2 chỉ số P1 còn thiếu trong phân tích xu hướng (Missing P1 Metrics)
- **Vấn đề:** `computeProfileMetrics` trước đây thiếu 2 chỉ số P1: (1) Đối chiếu lịch rảnh trong hồ sơ với giờ hoạt động thực tế theo múi giờ Việt Nam; (2) Tiến độ mục tiêu đối chiếu với kết quả buổi tập (`session_results`).
- **Cách khắc phục:**
  - Bổ sung `ScheduleAlignmentMetric` vào `src/lib/ai/trend-analysis.ts`: chuyển đổi thời điểm bắt đầu buổi tập sang giờ Việt Nam (UTC+7), đối chiếu thứ trong tuần với `profile.schedule_availability`, tính toán số buổi khớp và tỷ lệ phần trăm khớp.
  - Bổ sung `GoalProgressMetric`: truy vấn bảng `session_results` trong khoảng thời gian chu kỳ, đối chiếu với danh sách mục tiêu đang kích hoạt (`goals` có `status = 'active'`).
  - Cập nhật `analyzeProfileTrendsAction`: truy vấn đồng thời `session_results` bằng Supabase client và truyền vào `computeProfileMetrics`.
- **Tệp sửa:** `src/lib/ai/trend-analysis.ts`, `src/app/ai/actions.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E4`).

### E5: Xử lý an toàn khi đầu ra AI không có bất kỳ trích dẫn hợp lệ nào (Invalid References Fallback)
- **Vấn đề:** Khi ngữ cảnh có dữ liệu thực tế nhưng mô hình AI bịa đặt toàn bộ ID tham chiếu lạ (dẫn đến `validReferences.length === 0` sau khi lọc): trước đây bản tóm tắt vẫn được lưu là `ai_generated` với 0 tham chiếu, và câu trả lời vẫn lưu `completed`.
- **Cách khắc phục:**
  - Trong `generateAISummaryAction`: nếu ngữ cảnh có dữ liệu (`allowedRecordIds.size > 0`) nhưng sau khi lọc không còn tham chiếu hợp lệ nào, action tự động kích hoạt `generateTemplateSummary` dự phòng, chuyển `status = 'template_fallback'` và lấy tập trích dẫn trung thực từ dữ liệu thực tế.
  - Trong `askAIQuestionAction`: nếu ngữ cảnh có dữ liệu, câu hỏi không ngoài phạm vi nhưng AI không trích dẫn được bản ghi nào, action lưu tin nhắn trợ lý ở trạng thái `failed` và trả về lỗi thông báo người dùng, không xác nhận câu trả lời ảo giác.
- **Tệp sửa:** `src/app/ai/actions.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E5`).

### E6: Kiểm tra số liệu xu hướng bị hoán đổi đơn vị số buổi và thời lượng (Swapped Metric Verification)
- **Vấn đề:** Verifier trước đây chỉ kiểm tra sự tồn tại của con số mà không gắn chặt với đơn vị đi kèm, dẫn đến việc văn bản sai lệch như "150 buổi với tổng thời lượng 4 phút" (khi thực tế 4 buổi và 150 phút) không bị loại bỏ.
- **Cách khắc phục:**
  - Viết lại hàm `validateHighlightNumbersAndUnits` trong `src/lib/ai/trend-analysis.ts`: sử dụng biểu thức chính quy bóc tách rõ ràng từng đại lượng và đơn vị:
    - Số buổi: `/(?:^|[^\d.,])(\d+)\s*(?:buổi|lượt tập|buoi|session)(?!\w)/i` -> so khớp với `expectedSessions`.
    - Số phút: `/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:phút|phut|minute|min)(?!\w)/i` -> so khớp với `expectedMinutes`.
    - Phần trăm: `/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:%|phần trăm)(?!\w)/i` -> so khớp với `expectedPercent`.
    - Mức mệt: `/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:\/10|mức mệt)(?!\w)/i` -> so khớp với `expectedFatigue`.
    - Số tuần: `/(?:^|[^\d.,])(\d+)\s*(?:tuần|tuan|week)(?!\w)/i` -> so khớp với `expectedWeeks`.
  - Bất kỳ sự hoán đổi nào giữa số buổi và số phút đều bị phát hiện và loại bỏ ngay lập tức.
- **Tệp sửa:** `src/lib/ai/trend-analysis.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E6`).

### E7: Khắc phục việc mẫu dự phòng trung thực bị loại bỏ do chứa ngày tháng (Template Fallback Preserved)
- **Vấn đề:** Chuỗi tổng quan của mẫu dự phòng có chứa ngày tháng (ví dụ "Trong 4 tuần qua (29/09/2026 - 27/10/2026)..."). Các con số ngày tháng (29, 09, 2026) trước đây bị trích xuất nhầm thành số liệu vận động và khiến verifier loại bỏ oan điểm nổi bật trung thực này.
- **Cách khắc phục:**
  - Trong `validateHighlightNumbersAndUnits`: loại bỏ toàn bộ các mẫu ngày tháng (`dd/mm/yyyy` và `yyyy-mm-dd`) khỏi chuỗi văn bản trước khi trích xuất số liệu vận động:
    ```ts
    const sanitizedText = text
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
    ```
  - Điểm nổi bật tổng quan trung thực của mẫu dự phòng được giữ lại trọn vẹn 100%.
- **Tệp sửa:** `src/lib/ai/trend-analysis.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E7`).

### E8: Xử lý lỗi khi ghi tin nhắn trợ lý vào cơ sở dữ liệu (Assistant Persistence Error)
- **Vấn đề:** Trong `askAIQuestionAction`, thao tác `adminClient.from('ai_messages').insert(...)` cho câu trả lời của trợ lý trước đây không kiểm tra `{ error }`, dẫn đến việc nếu thao tác ghi DB thất bại thì action vẫn báo `success: true`.
- **Cách khắc phục:**
  - Kiểm tra `assistantInsertErr` sau khi ghi tin nhắn trợ lý: nếu có lỗi, action lập tức trả về `{ success: false, error: ... }`.
- **Tệp sửa:** `src/app/ai/actions.ts`.

### E9: Khắc phục lệch pha schema `period_used` giữa Zod và Provider (Provider vs Zod Schema Mismatch)
- **Vấn đề:** Schema yêu cầu của Google Gemini provider không bắt buộc trường `period_used`, trong khi schema Zod của server trước đây yêu cầu trường này, khiến phản hồi hợp lệ từ mô hình bị Zod từ chối (`invalid_type: Required`).
- **Cách khắc phục:**
  - Sửa `src/lib/ai/schemas.ts`: định nghĩa `period_used: z.string().nullable().optional().default(null)`. Khi provider không trả về trường này, Zod tự động gán giá trị mặc định `null` mà không gây lỗi.
- **Tệp sửa:** `src/lib/ai/schemas.ts`.
- **Regression Test:** `src/tests/agent-e-ai.test.ts` (test case `E9`).

### E10: Đính chính đơn giá Google Gemini 3.5 Flash-Lite & Minh bạch Mock vs Live
- **Vấn đề:** Báo cáo trước đây ghi nhận đơn giá cũ chưa chính xác cho model `gemini-3.5-flash-lite`.
- **Cách khắc phục:**
  - Khảo sát và đối chiếu trực tiếp từ bảng giá chính thức của Google: đơn giá Standard Paid Tier của `gemini-3.5-flash-lite` là **\$0.30 / 1 triệu input tokens** và **\$2.50 / 1 triệu output tokens** (bao gồm cả thinking tokens).
  - Khẳng định tính minh bạch: toàn bộ quy trình `npm run test` của CalisCoaching chạy trên môi trường cô lập, sử dụng fixture nhân tạo và mock adapter, không gọi ra Internet, không tiêu tốn token và không phụ thuộc API key thật.

---

## 2. Khảo sát SDK, Đơn giá & Quyền riêng tư Google Gemini

*(Khảo sát và đối chiếu ngày 27/10/2026 từ tài liệu nhà phát triển chính thức của Google)*

| Tiêu chí | Thông tin chi tiết | Nguồn tài liệu chính thức |
|---|---|---|
| **Model ID** | `gemini-3.5-flash-lite` | [Google AI for Developers - Models](https://ai.google.dev/gemini-api/docs/models/gemini) |
| **SDK chính thức** | `@google/genai` (v2.31.0) | [Google Gen AI SDK for TypeScript/JavaScript](https://github.com/google-gemini/generative-ai-js) |
| **Đầu ra có cấu trúc** | `responseMimeType: 'application/json'`, `responseSchema: {...}` | [Gemini API Structured Outputs Guide](https://ai.google.dev/gemini-api/docs/structured-output) |
| **Đơn giá (Standard Paid Tier)** | **\$0.30 / 1M input tokens**<br>**\$2.50 / 1M output tokens** (bao gồm cả thinking tokens) | [Google AI Gemini API Pricing](https://ai.google.dev/pricing) |
| **Hạn mức gói miễn phí (Free Tier)** | 15 RPM (Requests Per Minute), 1,500 RPD (Requests Per Day), 1,000,000 TPM | [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| **Hạn mức gói trả phí (Pay-as-you-go)** | 1,000 RPM, 4,000,000 TPM | [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| **Quyền riêng tư & Bảo mật dữ liệu** | **Gói trả phí (Paid Tier):** Dữ liệu không được Google lưu giữ để huấn luyện mô hình cơ bản. Tuân thủ nghiêm ngặt Google Cloud Data Governance & Privacy Terms. | [Google Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) |

---

## 3. Lệnh kiểm tra và Kết quả xác minh thực tế

```bash
# 1. Chạy toàn bộ bộ kiểm thử tự động (Unit test, quy tắc nghiệp vụ, PGlite RLS & Regression)
npm run test
```
**Kết quả thực tế:**
- **8/8 test files passed (100%)**
- **117/117 tests passed** (bao gồm 29 tests của Agent E bao phủ toàn bộ S1–S3, E1–E9 và RLS PGlite).
- Thời gian thực thi: ~7.9s.

```bash
# 2. Kiểm tra tính toàn vẹn kiểu dữ liệu tĩnh (Static type checking)
npx tsc --noEmit
```
**Kết quả thực tế:** Thoát mã `0` (Zero errors tuyệt đối).

```bash
# 3. Biên dịch Next.js Production Build
npm run build
```
**Kết quả thực tế:** Thành công trong 16.8s. Tuyến đường `/ai` được tối ưu kích thước bundle đạt 9.71 kB, hoàn toàn tương thích production.

---

## 4. Bảng tổng hợp tệp thay đổi và Phân công quyền sở hữu

| Tệp đã chỉnh sửa | Mục đích / Nội dung sửa | Quyền sở hữu |
|---|---|---|
| `src/app/dashboard/page.tsx` | Sửa duy nhất 1 truy vấn `ai_summaries` (Lỗi 1): lọc loại trừ `kind = 'analysis'`, không chạm phần khác của Agent B | Cho phép ngoại lệ theo chỉ đạo |
| `src/app/ai/page.tsx` | Tách truy vấn tóm tắt vs xu hướng, thu thập `loadError` khi DB lỗi | Agent E |
| `src/app/ai/actions.ts` | Áp dụng cận trên `lte`, thực thi scope lịch sử, fallback khi ID ảo giác, kiểm tra lỗi ghi trợ lý | Agent E |
| `src/lib/ai/context.ts` | Lọc `review_suggestions` theo scope `activities`, lọc ID tham chiếu theo `allowedRecordIds`, áp dụng cận `lte` | Agent E |
| `src/lib/ai/history.ts` | Lọc lịch sử đa lượt theo scope (loại bỏ tin nhắc dữ liệu ngoài scope, trả rỗng khi scope rỗng) | Agent E |
| `src/lib/ai/schemas.ts` | Cho phép `period_used` là `nullable().optional().default(null)` khớp với Gemini provider schema | Agent E |
| `src/lib/ai/trend-analysis.ts` | Bổ sung `schedule_alignment` (UTC+7) & `goal_progress`, bóc tách ngày tháng trước khi kiểm tra số, chống đảo số buổi và phút | Agent E |
| `src/lib/ai/providers/gemini.ts` | AbortController, usageMetadata, kiểm tra BLOCKED/TRUNCATED, đóng gói câu hỏi vào `<user_records>`, thông báo lỗi 429 | Agent E |
| `src/lib/ai/factory.ts` | Cô lập `MockAIAdapter`, chỉ dùng khi test chèn tường minh | Agent E |
| `src/components/ai/AIChatBox.tsx` | Nút thử lại tìm câu hỏi gốc của người dùng (`precedingUserMsg`) thay vì gửi chuỗi thông báo lỗi | Agent E |
| `src/components/ai/AIConsentBanner.tsx` | Công bố đầy đủ 4 danh mục dữ liệu, cảnh báo gửi nguyên văn ghi chú/câu hỏi, dẫn chứng Google Paid Tier | Agent E |
| `src/components/ai/AIManager.tsx` | Tiếp nhận và hiển thị `loadError` thay vì rơi vào trạng thái trống giả định | Agent E |
| `src/components/ai/AISummaryCard.tsx` | Hiển thị thông báo khi có `loadError` thay vì "Chưa có bản tóm tắt nào" | Agent E |
| `src/components/ai/AITrendCard.tsx` | Hiển thị thông báo khi có `loadError` thay vì "Chưa có bản phân tích nào" | Agent E |
| `src/tests/agent-e-ai.test.ts` | Bộ 29 tests kiểm thử toàn diện: Context, Safe History, Prompt Injection, RLS PGlite, S1–S3, E1–E9 | Agent E |
| `BAN_GIAO_E.md` | Báo cáo bàn giao chi tiết kết quả rà soát | Agent E |

---

## 5. Cam kết an toàn & Nguyên tắc tuân thủ MVP

1. **Bảo mật & Quyền riêng tư:** Tuyệt đối không gửi họ tên thật, email hay `user_id` sang mô hình AI. Mọi dữ liệu rèn luyện đều được kiểm soát bởi Scope of Consent có hiệu lực.
2. **Không ảo giác ID (Anti-hallucination):** ID tham chiếu trả về từ AI bắt buộc phải đối chiếu với tập `allowedRecordIds`. Không có tham chiếu hợp lệ thì tự động fallback về mẫu tổng hợp dự phòng minh bạch.
3. **Phân quyền cơ sở dữ liệu:** Client (authenticated) bị chặn tuyệt đối quyền ghi trực tiếp vào `ai_summaries` và `ai_messages` qua Postgres RLS; chỉ có Server Service Role Client mới được phép lưu trữ sau khi kiểm chứng tính hợp lệ.
4. **Không can thiệp ngoài phạm vi:** Không sửa đổi các tệp của Agent A, B, C, D (ngoại trừ duy nhất 1 dòng truy vấn lọc dashboard theo chỉ thị). Không commit, không deploy, không ghi bí mật vào mã nguồn.
