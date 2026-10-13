# WSIC — White Paper

**Nền tảng học tập sinh nội dung bằng AI tác tử: kiến trúc, đường đi của một chủ đề, và những gì cần cải thiện**

| | |
| --- | --- |
| **Phiên bản** | 1.0 — 13/10/2026 |
| **Phạm vi** | Toàn bộ hệ thống WSIC (ứng dụng web, backend Convex, các container AI, hạ tầng) |
| **Đối tượng đọc** | Kỹ sư phần mềm, kiến trúc sư, người bảo trì dự án |
| **Tài liệu liên quan** | [`architecture.md`](./architecture.md) · [`c4-architecture.md`](./c4-architecture.md) · [`topic-generation.md`](./topic-generation.md) · [`search-system.md`](./search-system.md) |

---

## Tóm tắt

WSIC là một nền tảng học tập khai thác **điểm yếu cố hữu của con người**: chúng ta luôn tò mò về những chủ đề mà tài nguyên học tập hiện có *chưa* bao phủ. Thay vì chờ ai đó viết nội dung, WSIC **sinh ra nó tại thời điểm người dùng hỏi** — một "module" học tập gồm 7 khối nội dung tương tác (tóm tắt nghiên cứu, quiz, sắp xếp thứ tự, tác động thực tiễn, flash cards), được tạo bởi **11 tác tử AI chạy tuần tự**, kèm thumbnail và embedding cho tìm kiếm tương tự.

Về mặt kỹ thuật, đóng góp của WSIC không nằm ở mô hình AI mà nằm ở **cách tổ chức**:

1. **Kiến trúc lai ba lớp** — một ứng dụng Next.js 16 trên Vercel, một backend Convex (realtime + vector search + cron), một tầng Python (Flask + Google ADK trên Cloud Run) lo toàn bộ việc sinh nội dung. Các lớp giao tiếp qua **hai cơ chế duy nhất**: API có kiểm tra kiểu (web ↔ Convex) và **tên hàm dạng chuỗi** (Python ↔ Convex).
2. **Sinh nội dung bất đồng bộ có kiểm soát** — một module mất 3–4 phút để sinh, nên toàn bộ luồng được đẩy qua hàng đợi Upstash QStash với 3 lần thử lại cách 30 giây; người dùng quay lại trang và thấy module của mình đã sẵn sàng qua **đẩy dữ liệu realtime** (WebSocket), không cần polling.
3. **Tách rời tuyệt đối giữa tầng AI và tầng giao diện** — các tác tử ghi thẳng vào Convex, hoàn toàn không biết giao diện tồn tại. Nhờ vậy, thêm một kênh phân phối mới (mobile, API công khai) không cần chạm vào pipeline AI.

Tài liệu này mô tả hệ thống theo bốn cấp của **mô hình C4**, đi sâu vào luồng sinh nội dung và pipeline tác tử, phân tích mô hình dữ liệu và hai cơ chế tìm kiếm, và kết thúc bằng **năm rủi ro đã xác định kèm cách giảm thiểu**, cùng lộ trình phát triển ba giai đoạn. Điểm quan trọng nhất dành cho người bảo trì: **ranh giới dễ vỡ nhất của WSIC là hợp đồng giữa `convex/schema.ts` (TypeScript) và các tác tử Python, vì nó được giữ bằng tay, không được kiểm tra lúc build.**

---

## 1. Bối cảnh và vấn đề

### 1.1 Vấn đề

Các nền tảng học tập hiện có (Coursera, Khan Academy, YouTube, blog kỹ thuật) đều hoạt động theo mô hình **nội dung có trước, người học có sau**. Hệ quả:

- **Độ trễ nội dung:** một chủ đề mới nổi (một mô hình AI vừa ra mắt, một lỗ hổng bảo mật mới) mất hàng tuần đến hàng tháng mới có bài học chất lượng.
- **Độ phủ đuôi dài kém:** kinh tế học nội dung khiến không ai viết về những chủ đề chỉ vài nghìn người quan tâm — dù tổng nhu cầu của *tất cả* chủ đề đuôi dài là rất lớn.
- **Một khuôn mẫu cho mọi chủ đề:** nội dung tĩnh không thích ứng với trình độ, tốc độ, hay nhu cầu "vừa đủ hiểu" của người đọc phổ thông.

### 1.2 Vì sao "brew" thay vì chỉ tìm kiếm

WSIC chọn một tiền đề khác: **học là một hành động chủ động, không phải một truy vấn**. Người dùng không "tìm bài viết về X", họ **"ủ" (brew) một module về X** — quá trình này tạo ra:

- nội dung được viết *cho đúng chủ đề đó*, không phải nội dung gần đúng nhất đang tồn tại;
- kèm **nguồn tham chiếu** (Exa) để kiểm chứng;\\*
- dạng tương tác (quiz, sắp xếp, flash cards) buộc người đọc phải nhớ, không chỉ đọc lướt;
- có thể được chia sẻ lại — biến chi phí sinh nội dung thành tài sản dùng chung.

> \\* **Trung thực về giới hạn:** pipeline hiện sinh `source_urls` cho khối "tác động thực tiễn", nhưng **không có bước kiểm chứng (grounding check) tự động** đối chiếu từng câu với nguồn. Xem §9.2, rủi ro R5.

### 1.3 Giả định thiết kế

| # | Giả định | Hệ quả kiến trúc |
| --- | --- | --- |
| A1 | Sinh một module mất **hàng phút**, không phải hàng giây | Buộc phải có hàng đợi + webhook + trạng thái thất bại có thể thử lại |
| A2 | Chất lượng nội dung quan trọng hơn độ trễ | Chọn pipeline tuần tự 11 bước, không chọn một prompt khổng lồ |
| A3 | Người dùng sẵn sàng rời trang rồi quay lại | Thông báo realtime thay vì chờ đồng bộ |
| A4 | Truy vấn tìm kiếm là **ngắn, mơ hồ, mang ý niệm** | Bắt buộc phải có tìm kiếm ngữ nghĩa bên cạnh tìm kiếm toàn văn |
| A5 | Chi phí mô hình phải ở mức chấp nhận được cho một dự án nhỏ | Phân tầng model: việc nặng dùng `gemini-2.5-flash`, việc định dạng dùng `gemini-2.0-flash-lite` |

---

## 2. Mục tiêu và phạm vi

### 2.1 Mục tiêu

| Mục tiêu | Tiêu chí đạt được trong mã nguồn hiện tại |
| --- | --- |
| **M1 — Sinh module học tập hoàn chỉnh từ một chủ đề** | `OrchestratorAgent` + 11 sub-agent; 7 loại khối nội dung; thumbnail; mô tả; thẻ phân loại |
| **M2 — Người dùng không phải chờ** | `/api/queue-topic-request` trả về `messageId` ngay; thông báo realtime khi module xong |
| **M3 — Chủ đề rác bị chặn trước khi tốn 3–4 phút GPU** | Container `topic-checker` độc lập chạy *trước* khi sinh; thông báo `bad_topic` nếu không hợp lệ |
| **M4 — Tìm được nội dung đã có theo cả từ khoá lẫn ý niệm** | `searchIndex "search_topics"` + `vectorIndex "by_embedding"` (768 chiều) |
| **M5 — Tương tác không cần tài khoản nhưng vẫn được lưu** | better-auth + plugin `anonymous`; đăng nhập Google sau đó *nâng cấp* cùng người dùng |
| **M6 — Vận hành được với chi phí thấp** | Vercel + Convex + Render + Cloud Run; cron 1 giờ/lần cho trending; scale-to-zero ở tầng AI |

### 2.2 Ngoài phạm vi (non-goals)

- **Không** tự đánh giá chất lượng nội dung sau khi sinh (chưa có vòng lặp phản hồi người dùng → prompt).
- **Không** đa ngôn ngữ — toàn bộ nội dung sinh ra bằng tiếng Anh, dù tài liệu dự án bằng tiếng Việt.
- **Không** tìm kiếm ngữ nghĩa *bên trong* nội dung khối (chỉ embedding ở cấp chủ đề).
- **Không** có thanh toán / phân quyền theo gói (có `SubscriptionCard` nhưng chỉ là giao diện mời).
- **Không** có bảng kiểm chứng nguồn (citation verification).

---

## 3. Kiến trúc hệ thống

### 3.1 Tổng quan — C4 cấp 1 (ngữ cảnh)

![C4 cấp 1 — ngữ cảnh hệ thống](./diagrams/c4/c4-1-context.png)

WSIC là **một hệ thống** với hai tác nhân (người học, vận hành viên) và năm hệ thống ngoài: Google Identity, Google Gemini, Exa AI, Serper, Upstash QStash. Điểm cần nhấn mạnh: **QStash là quan hệ hai chiều** — WSIC gọi QStash để xếp hàng, và QStash gọi *ngược lại* WSIC qua webhook. Vì vậy điểm vào của luồng sinh nội dung phải luôn trực tuyến, không thể là một hàm serverless ngắn hạn.

### 3.2 C4 cấp 2 (container)

![C4 cấp 2 — container](./diagrams/c4/c4-2-container.png)

| Container | Công nghệ | Nền tảng | Trách nhiệm |
| --- | --- | --- | --- |
| **Ứng dụng Web** | Next.js 16 · React 19 · TS · Tailwind 4 | Vercel | Giao diện, Route Handlers, `proxy.ts`, SSR |
| **Convex Deployment** | Convex functions + cron + 2 chỉ mục | Convex Cloud | Backend chính: dữ liệu, realtime, vector search |
| **PostgreSQL** | PostgreSQL | Dịch vụ ngoài | Chỉ xác thực (`user`, `session`, `account`, `verification`) |
| **generator_api** | Python · Flask · Gunicorn | Render | Webhook, quản lý session ADK, bóc JSON, quyết định mã lỗi |
| **topic-checker** | Google ADK | Cloud Run | Kiểm duyệt chủ đề |
| **topic-generator** | Google ADK | Cloud Run | Pipeline 11 tác tử |

### 3.3 Các quyết định kiến trúc then chốt

**QĐ1 — Backend chính là Convex, không phải một REST API tự viết.**
Đánh đổi: WSIC nhận được realtime, giao dịch, chỉ mục toàn văn và vector *miễn phí về công sức*; đổi lại phụ thuộc vào một nền tảng độc quyền, và tầng Python (không phải JS) buộc phải gọi qua tên chuỗi — mất toàn bộ an toàn kiểu.

**QĐ2 — Tầng AI là các container Python riêng, không phải Route Handlers của Next.js.**
Đánh đổi: pipeline chạy 3–4 phút, vượt xa giới hạn thực tế của một serverless function trong luồng này; tách ra còn cho phép "hâm nóng" (warm) các container AI và không phụ thuộc thời gian build của web. Giá phải trả: thêm một nền tảng (Cloud Run), thêm một lớp điều phối (Flask), và thêm biến môi trường để sai.

**QĐ3 — Hàng đợi QStash thay vì `BackgroundTasks` hay một hàng đợi tự dựng.**
`publishJSON()` với `retries: 3`, `retryDelay: "30000"` cho một cơ chế thử lại *nhìn thấy được* mà không cần hạ tầng. Đánh đổi: **QStash không đảm bảo chống trùng** — xem R2 trong §9.2.

**QĐ4 — Hai cơ sở dữ liệu, chấp nhận không có khoá ngoại giữa chúng.**
PostgreSQL giữ phiên đăng nhập; Convex giữ mọi thứ khác. `createdBy` (topics), `userId` (userTopicInteractions), `userId` (notifications) chỉ là **chuỗi ID tham chiếu** — Convex không thể join sang PostgreSQL. Điều này chấp nhận được vì luồng đọc chính (xem chủ đề) không cần dữ liệu người dùng, nhưng nó có nghĩa: **xoá một user không tự động xoá dữ liệu tương tác của họ.**

**QĐ5 — Tách `topic-checker` khỏi `topic-generator`.**
Kiểm duyệt là bài toán *phân loại rẻ* (một lời gọi `gemini-2.5-flash`, container nhỏ, ít phụ thuộc), trong khi sinh nội dung là bài toán *generation đắt*. Tách ra cho phép scale và định giá độc lập: nếu tỉ lệ chủ đề rác cao, chỉ cần scale checker. Giá phải trả: đoạn mã gọi session ADK bị lặp hai lần trong `app.py`.

**QĐ6 — Phân tầng model theo loại công việc.**
`gemini-2.5-flash` cho việc cần suy luận (nghiên cứu, kiểm duyệt, mô tả/ý nghĩa, điều phối ghi dữ liệu); `gemini-2.0-flash-lite` cho việc có `output_schema` chặt (quiz, sắp xếp, flash cards, lắp ghép). Cách này giảm chi phí đáng kể mà gần như không mất chất lượng, vì các bước dùng lite đều bị **ràng buộc bởi JSON schema**.

### 3.4 C4 cấp 3 (component)

- **Ứng dụng Web:** `proxy.ts` (chặn `/user/*`, `/topic/*`), Route máy chủ (SSR + metadata), `app/api/auth/[...all]/route.ts`, `/api/queue-topic-request`, `/api/health/auth`, `lib/auth*`, các khối trang/nội dung, hooks dữ liệu, providers. → [`c4-3-components-web.png`](./diagrams/c4/c4-3-components-web.png)
- **Convex:** 4 kiểu client (web client có kiểm tra kiểu; web server có kiểm tra kiểu; **agent Python gọi tên chuỗi, không kiểm tra kiểu**; CLI deploy) và 4 miền module (nội dung & khám phá / tương tác & thông báo / AI & vector / nền tảng). → [`c4-3-components-convex.png`](./diagrams/c4/c4-3-components-convex.png)
- **Các container AI:** ADK Runtime API, `TopicCheckerAgent`, `OrchestratorAgent` + 11 sub-agent, 5 công cụ. → [`c4-3-components-agents.png`](./diagrams/c4/c4-3-components-agents.png)

---

## 4. Luồng sinh nội dung bất đồng bộ

Sơ đồ động đầy đủ (kèm nhánh lỗi): [`diagrams/02-luong-sinh-noi-dung.png`](./diagrams/02-luong-sinh-noi-dung.png).

### 4.1 Trình tự (happy path)

| # | Nơi xảy ra | Hành động |
| --- | --- | --- |
| 1 | Trình duyệt | Người dùng nhập chủ đề + độ khó → `POST /api/queue-topic-request` |
| 2 | Next.js Route Handler | `QStash.publishJSON({ url: TOPIC_GENERATOR_RENDER_URL, retries: 3, retryDelay: "30000" })` → trả `qstashMessageId` **ngay lập tức** |
| 3 | QStash | Giữ yêu cầu, gọi `POST /generate-topic` trên Render |
| 4 | `generator_api` | Tạo session ADK, gọi `POST /run` sang `topic-checker` → `{status: VALID}` |
| 5 | `generator_api` | Tạo session ADK thứ hai, gọi `POST /run` sang `topic-generator` (chạy 11 tác tử) |
| 6 | `topic-generator` | `OrchestratorAgent` chạy tuần tự, mỗi tác tử ghi kết quả vào state dùng chung |
| 7 | `ConvexInserterAgent` | Gọi `insert_topic_to_convex()`: `createTopic` → `createBlock` **×7** → `createEmbedding` → `createNotification("topic_generated")` |
| 8 | Convex | Ghi dữ liệu → **đẩy realtime** tới mọi client đang mở qua WebSocket |
| 9 | Ứng dụng Web | `useNotifications()` bắt thông báo → toast "Chủ đề đã sẵn sàng" |
| 10 | `generator_api` | Bóc JSON khỏi phản hồi ADK, xoá session, trả 200 cho QStash (QStash ngừng thử lại) |

### 4.2 Nhánh lỗi và thử lại

| Tình huống | Hành vi hiện tại | Đánh giá |
| --- | --- | --- |
| Thiếu dữ liệu đầu vào (`topic`, `user_id`) | Trả **489** kèm header `Upstash-NonRetryable-Error: true` → QStash **không** thử lại | ✅ Đúng: lỗi xác định thì không nên thử lại |
| Chủ đề `INVALID` | `TopicCheckerAgent` gọi `create_bad_topic_notification()` → thông báo `bad_topic`; trả 489 (không thử lại), không sinh nội dung | ✅ Đúng: chặn sớm, tiết kiệm 3–4 phút GPU |
| ADK trả non-200 hoặc JSON không parse được | `parse_json_from_markdown()` trả `should_retry`; `app.py` trả 500 → QStash thử lại (tối đa 3 lần, cách 30 s) | ⚠️ Đúng về ý tưởng, nhưng xem **R2**: lần thử lại sẽ **sinh lại từ đầu** |
| Tác tử ghi Convex thất bại | `insert_topic_to_convex()` trả `success = false` → coi như thất bại → QStash thử lại | ⚠️ Không rõ phần nào đã ghi, phần nào chưa (không có giao dịch bắc qua nhiều mutation) |
| Model trả markdown bọc JSON | `parse_json_from_markdown()` tách khối ```json``` trước khi `json.loads` | ✅ Có kiểm thử riêng: `generator_api/test_parse_json.py` |
| Hết 3 lần thử | QStash bỏ; **không có thông báo thất bại nào tới người dùng** | ❌ Lỗ hổng trải nghiệm: yêu cầu biến mất im lặng |

**Dấu hiệu tốt về mặt kỹ thuật:** mã nguồn **tự nhận diện** vấn đề R2 và đã ghi lại cách sửa. Ngay trong `generator_api/app.py`, trên nhánh kiểm tra `run_response.status_code != 200`, có ghi chú:

> *“Sometimes even if topic is generated, it is still returning a non 200 response, which is resulting in double generation due to retry. Make the flow more robust by using a newly created table called `topic_generation_requests` and using that as an alternative source of truth. Maybe use the `qstash_message_id` in that table to keep track of whether it is in progress, error or success.”*

Vì vậy, đề xuất ở R2 **không phải ý kiến từ bên ngoài** — nó là việc đã được người phát triển nhận ra, chỉ chưa thực hiện. Tài liệu này xếp nó vào nhóm ưu tiên cao của §10.1 vì lý do đó.

### 4.3 Ngân sách thời gian (ước lượng)

| Chặng | Thời gian |
| --- | --- |
| Trình duyệt → QStash → Flask | ~1 giây |
| Kiểm duyệt (`topic-checker`) | ~5–15 giây |
| Sinh nội dung (11 tác tử, gồm 3 lần gọi Exa + 1 lần Serper + 1 lần Gemini embedding) | **~3–4 phút** (phần lớn) |
| Ghi Convex + đẩy realtime | < 1 giây |
| **Tổng** | **~3–4 phút**, người dùng không phải giữ kết nối |

Con số 3–4 phút này là **ràng buộc thiết kế quan trọng nhất** của toàn hệ thống: nó giải thích sự tồn tại của QStash, của webhook trên Render, của thông báo realtime, và của `topic-checker` như một bộ lọc rẻ chạy trước.

---

## 5. Pipeline 11 tác tử

Sơ đồ chi tiết: [`diagrams/03-multi-agent.png`](./diagrams/03-multi-agent.png).

### 5.1 Bảng tác tử

`OrchestratorAgent` là một **`SequentialAgent`** — mỗi bước chạy xong mới sang bước sau, dữ liệu truyền qua **state dùng chung** bằng `output_key`.

| # | Tác tử | Model | Đầu ra (`output_key`) | Công cụ |
| --- | --- | --- | --- | --- |
| 1 | `ResearchAgentBrief` | 2.5-flash | `research_brief_output` — nghiên cứu tổng quan | `exa_search()` |
| 2 | `QuizAgent` | 2.0-flash-lite | `quiz_output` — 3 câu hỏi (schema chặt) | — |
| 3 | `ResearchAgentDeep` | 2.5-flash | `research_deep_output` — nghiên cứu chuyên sâu | `exa_search()` |
| 4 | `ReorderAgent` | 2.0-flash-lite | `reorder_output` — bài tập sắp xếp | — |
| 5 | `RealWorldImpactAgent` | 2.5-flash | `impact_output` — tác động thực tiễn + **nguồn** | `exa_search()` |
| 6 | `FinalQuizAgent` | 2.0-flash-lite | `final_quiz_output` — kiểm tra cuối | — |
| 7 | `SummaryAgent` | 2.0-flash-lite | `summary_output` — flash cards | — |
| 8 | `CategoryTagsDescriptionAgent` | 2.5-flash | `category_tags_description_output` — phân loại, thẻ, mô tả | `get_categories_from_convex()` |
| 9 | `ThumbnailGeneratorAgent` | 2.5-flash | `thumbnail_output` | `serper_image_search()` |
| 10 | `AssemblerAgent` | 2.0-flash-lite | `final_module` — lắp ghép thành một JSON hoàn chỉnh | — |
| 11 | `ConvexInserterAgent` | 2.5-flash | `insertion_result` — ghi vào Convex | `insert_topic_to_convex()` |

### 5.2 Vì sao pipeline tuần tự thay vì một prompt

| Tiêu chí | Một prompt khổng lồ | 11 tác tử tuần tự (đang dùng) |
| --- | --- | --- |
| Kích thước đầu ra | Vượt giới hạn token đầu ra | Mỗi bước một phần nhỏ |
| Ràng buộc kiểu | Không thể — một schema cho mọi thứ | `output_schema` riêng cho từng bước |
| Khả năng gỡ lỗi | Chỉ thấy kết quả cuối | Thấy chính xác bước nào sai (mỗi bước có `output_key`) |
| Khả năng sửa cục bộ | Phải sinh lại toàn bộ | Chỉ sửa prompt của bước hỏng |
| **Thời gian** | Nhanh hơn (1 lời gọi) | **Chậm hơn** — 11 lời gọi nối tiếp |
| **Chi phí** | Cao nếu dùng model mạnh cho mọi thứ | Thấp nhờ phân tầng model |

WSIC chọn tuần tự vì chất lượng và khả năng gỡ lỗi quan trọng hơn 1–2 phút độ trễ trong một luồng đã bất đồng bộ — người dùng không chờ tại chỗ.

### 5.3 Các mẫu thiết kế đáng chú ý trong pipeline

1. **Phân tầng model** (QĐ6): 6/11 tác tử dùng `gemini-2.0-flash-lite`.
2. **`output_schema` + `output_key`** cho mọi tác tử sinh dữ liệu — biến "hy vọng model trả đúng" thành một hợp đồng có thể kiểm tra ngay tại bước đó.
3. **Cổng ghi dữ liệu duy nhất:** chỉ tác tử 11 chạm vào Convex (ngoài tác tử 8 đọc danh mục). Một điểm ghi ⇒ một điểm cần gỡ lỗi.
4. **Ghi gộp trong một công cụ:** `insert_topic_to_convex()` thực hiện `createTopic` → `createBlock ×7` → `createEmbedding` → `createNotification` trong **một** lời gọi công cụ, để tác tử không "quên" bước nào.
5. **Tác tử 2 và 6 (quiz đầu/cuối) tách rời:** quiz đầu tạo "neo nhận thức" trước khi đọc, quiz cuối kiểm tra sau khi đọc — một kỹ thuật sư phạm, không phải trùng lặp.

### 5.4 Công cụ (ranh giới duy nhất với thế giới ngoài)

| Công cụ | Tác tử dùng | Nhà cung cấp | Ghi chú |
| --- | --- | --- | --- |
| `exa_search()` | 1, 3, 5 | Exa AI | Số kết quả điều chỉnh bằng `EXA_NUM_RESULTS` |
| `serper_image_search()` | 9 | Serper | Sinh thumbnail |
| `get_categories_from_convex()` | 8 | Convex | Đọc danh mục để tác tử chỉ được chọn trong danh mục hợp lệ |
| `insert_topic_to_convex()` | 11 | Convex | Ghi toàn bộ module |
| `create_bad_topic_notification()` | topic-checker | Convex | Tạo thông báo `bad_topic` |
| `generate_embedding()` | (hàm nội bộ) | Google Gemini | `gemini-embedding-001`, 768 chiều |

**Quan sát thiết kế:** `generate_embedding()` là **hàm nội bộ**, không phải một tác tử có `output_key`. Embedding được tính bên trong `createEmbedding`. Điều này hợp lý về mặt kỹ thuật (embedding không phải "nội dung"), nhưng có nghĩa: **không có bước nào trong pipeline có thể đánh giá hoặc sửa embedding trước khi ghi** — nếu Gemini embedding lỗi, tác tử 11 thất bại ở bước gần cuối cùng của một quy trình đã tốn 3–4 phút.

---

## 6. Mô hình dữ liệu và hợp đồng

Sơ đồ quan hệ: [`diagrams/06-mo-hinh-du-lieu.png`](./diagrams/06-mo-hinh-du-lieu.png).

### 6.1 Bảy bảng trong Convex

| Bảng | Vai trò | Chỉ mục |
| --- | --- | --- |
| `categories` | Danh mục chủ đề | Theo `slug` |
| `topics` | Thực thể trung tâm | `searchIndex "search_topics"` (title, filter `categoryId`/`isPublished`/`isTrending`), `vectorIndex "by_embedding"` (768 chiều, filter `difficulty`/`categoryId`/`contentType`), cùng các chỉ mục tra cứu |
| `embeddings` | Vector 768 chiều + metadata | Chỉ mục theo `topicId` |
| `blocks` | 7 loại khối nội dung | Theo `topicId`, `position` |
| `userTopicInteractions` | view / like / save / share / complete | Theo `userId + topicId` |
| `notificationTypes` | Danh mục loại thông báo | Theo `key` |
| `notifications` | Thông báo người dùng | Theo `userId`, trạng thái đã đọc |

### 6.2 Hợp đồng nội dung: validator → union

`convex/schema.ts` là **nguồn chân lý duy nhất** cho 7 loại khối nội dung:

```
researchBriefValidator · researchDeepValidator · realWorldImpactValidator
summaryValidator · quizValidator · reorderValidator · finalQuizValidator
        ↓
blockContentValidator = v.union(...)
        ↓
blocks.content → buộc đúng một trong 7 hình dạng
```

Mỗi validator dùng `v.literal("...")` cho trường `step`, nên **không thể ghi một khối nội dung sai loại mà không bị Convex từ chối ngay lúc mutate**. Đây là hợp đồng mạnh nhất của hệ thống — nhưng chỉ có hiệu lực với client TypeScript.

### 6.3 Ràng buộc liên cơ sở dữ liệu: chuỗi ID, không khoá ngoại

```
PostgreSQL (better-auth)          Convex
  user.id (chuỗi)  ──────╌╌╌╌──►  topics.createdBy
                   ──────╌╌╌╌──►  userTopicInteractions.userId
                   ──────╌╌╌╌──►  notifications.userId
```

Không có FK, không có cascade. Hệ quả cần biết:

- Xoá người dùng ở PostgreSQL **không** xoá dữ liệu của họ ở Convex.
- Không thể viết một query Convex trả về "thông tin user + chủ đề của họ" trong một lần; phải ghép ở tầng ứng dụng.
- **Tích cực:** hai cơ sở dữ liệu có thể được sao lưu, nâng cấp và thay thế độc lập; sự cố PostgreSQL không làm mất nội dung.

### 6.4 Hợp đồng Python ↔ Convex — điểm dễ vỡ nhất

```python
# agents/topic-generator/agent.py (dạng minh hoạ)
client.mutation("topics:createTopic", {...})
client.mutation("blocks:createBlock", {...})   # × 7
client.mutation("embeddings:createEmbedding", {...})
client.mutation("notifications:createNotification", {...})
```

| Khía cạnh | Client TypeScript | Client Python (đang dùng) |
| --- | --- | --- |
| Tham chiếu hàm | `api.topics.createTopic` — có kiểm tra | `"topics:createTopic"` — **chuỗi trần** |
| Kiểu tham số | Sinh từ schema | Chỉ được bảo vệ bởi **union ở server** (Convex vẫn validate runtime) |
| Phát hiện lỗi | **Lúc build** | **Lúc chạy** (giữa pipeline 3–4 phút) |
| Đổi tên hàm | Build đỏ ngay | Lỗi `FunctionNotFound` trong log giữa đêm |

**May mắn quan trọng:** Convex vẫn kiểm tra `v.object(...)` ở **thời điểm chạy**, nên lỗi cấu trúc không thể ghi vào dữ liệu — nó chỉ *thất bại muộn*. Vấn đề không phải tính toàn vẹn dữ liệu mà là **thời điểm phát hiện**.

**Giảm thiểu đề xuất (R3):** sinh một module Python từ `convex/_generated/api.d.ts` trong CI (đối chiếu danh sách tên hàm + tham số) — biến lỗi "giữa đêm" thành lỗi "trong PR".

---

## 7. Tìm kiếm: toàn văn và ngữ nghĩa

Sơ đồ: [`diagrams/04-tim-kiem.png`](./diagrams/04-tim-kiem.png).

| | Tìm kiếm toàn văn | Tìm kiếm ngữ nghĩa |
| --- | --- | --- |
| Cài đặt | `convex/search.ts` → `searchIndex "search_topics"` | `convex/embeddings.ts` → `vectorIndex "by_embedding"` |
| Hàm | `simpleSearchTopics` | `getSimilarTopics` · `searchSimilarTopicsByTerm` (action) |
| Tìm trên | `title` (lọc `isPublished`, `difficulty`) | Vector 768 chiều của Gemini |
| Mạnh khi | Truy vấn chính xác, có từ khoá rõ | Truy vấn mơ hồ, ý niệm ("học máy có giám sát") |
| Yếu khi | Người dùng gõ sai/khác từ vựng | Không có lý do giải thích được |
| Chi phí | Rẻ, tức thời | Cần gọi Gemini để sinh vector cho truy vấn (~1 lời gọi/lần tìm) |

**Cách hai cơ chế phối hợp** trong `components/pages/SearchResults.tsx`: kết quả tương tự được lọc theo **ngưỡng điểm** `NEXT_PUBLIC_SIMILARITY_SCORE` (mặc định `0.85`) — trên ngưỡng thì hiển thị như "đã có chủ đề tương tự", dưới ngưỡng thì mời người dùng **brew** một chủ đề mới. Ngưỡng này là **bộ điều chỉnh sản phẩm**, không chỉ là tham số kỹ thuật:

- Ngưỡng **cao** → nhiều chủ đề bị coi là "chưa có" → sinh nhiều nội dung mới → tốn kém, nhưng kho nội dung phong phú.
- Ngưỡng **thấp** → tái sử dụng nhiều hơn → rẻ, nhưng dễ trả về kết quả không thật sự liên quan.

Vì là biến `NEXT_PUBLIC_*`, ngưỡng được nhúng vào gói JS lúc build — **đổi ngưỡng cần deploy lại web**, không sửa được lúc chạy.

---

## 8. Triển khai và vận hành

### 8.1 Nền tảng

| Thành phần | Nền tảng | Ghi chú |
| --- | --- | --- |
| Ứng dụng web | **Vercel** | `vercel.json`: `npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'npm run build'` |
| Backend + vector + cron | **Convex Cloud** | Deploy *trong* build của Vercel ⇒ schema và hàm luôn đồng bộ với web |
| Điều phối agent | **Render** | Điểm vào webhook ổn định cho QStash; `app.run(host='0.0.0.0', port=10000)` |
| Hai container AI | **Cloud Run** | Scale-to-zero; ADK runtime |
| Xác thực | **PostgreSQL ngoài** | Migration thủ công |

**Chi tiết đáng chú ý:** vì `convex deploy` nằm trong lệnh build của Vercel, nên **mỗi lần deploy web là một lần deploy backend**. Điều này loại bỏ hoàn toàn một lớp lỗi "web mới gọi hàm backend chưa tồn tại", nhưng cũng có nghĩa một lỗi trong `convex/` chặn cả deploy web.

### 8.2 Cron

```
crons.interval("update trending status", { hours: 1 }, internal.topics.updateTrendingStatus)
```

Mỗi giờ, Convex tính lại `isTrending` cho các chủ đề dựa trên chỉ số tương tác (`updateTopicMetrics`). Trending là **trạng thái vật chất hoá** (materialized) chứ không tính lúc đọc — đổi lại, chỉ mục `search_topics` có thể lọc theo `isTrending` mà không cần quét toàn bộ bảng.

### 8.3 Biến môi trường

**Ứng dụng web:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SIMILARITY_SCORE`, `NEXT_PUBLIC_SUCCESS_NOTIFICATION_KEY`, `POSTGRES_{HOST,PORT,DATABASE,USER,PASSWORD,SSL}`, `GOOGLE_{CLIENT_ID,CLIENT_SECRET,API_KEY}`, `QSTASH_TOKEN`, `TOPIC_GENERATOR_RENDER_URL`.
**Tầng Python:** `CONVEX_URL`, `GOOGLE_API_KEY`, `EXA_API_KEY`, `EXA_NUM_RESULTS`, `SERPER_API_KEY`, `TOPIC_CHECKER_BASE_URL`, `TOPIC_GENERATOR_BASE_URL`.

Ba nhận xét:

1. **`GOOGLE_API_KEY` bị dùng ở hai nơi** (web cho embedding, Python cho sinh nội dung) — một khoá cho hai mục đích, khó giới hạn quyền.
2. **`QSTASH_TOKEN` và `TOPIC_GENERATOR_RENDER_URL` chỉ ở web**, trong khi URL webhook được gửi *từ* web ⇒ đổi điểm vào Render phải deploy lại web.
3. **Không có biến môi trường nào cho ngưỡng hay số lần thử** ở tầng Python — ba lần thử và 30 giây bị hard-code trong route handler.

### 8.4 Giám sát

Hiện có `/api/health/auth` (kiểm tra Boolean biến môi trường + `select 1` trên PostgreSQL, **không lộ giá trị bí mật**) và `/ok` ở `generator_api`. Chưa có: đo thời gian từng tác tử, tỉ lệ thành công theo bước, cảnh báo khi hết 3 lần thử.

---

## 9. Đánh giá

### 9.1 Điểm mạnh

| # | Điểm mạnh | Vì sao quan trọng |
| --- | --- | --- |
| S1 | **Bất đồng bộ hoá hoàn toàn luồng 3–4 phút** | Người dùng không chờ; không có timeout nào bị chạm; QStash gánh việc thử lại |
| S2 | **Hợp đồng dữ liệu mạnh ở server** (7 validator + union) | Không thể ghi khối nội dung sai hình dạng, kể cả từ client Python |
| S3 | **Pipeline tách bước, có `output_key`** | Gỡ lỗi định vị được chính xác tác tử nào hỏng |
| S4 | **Chỉ một điểm ghi vào Convex từ tầng AI** (tác tử 11) | Bề mặt rủi ro nhỏ, dễ suy luận về tính nhất quán |
| S5 | **Tách tầng AI khỏi tầng giao diện** | Thêm kênh phân phối không cần chạm pipeline |
| S6 | **Phân tầng model** | Chi phí thấp ở 6/11 tác tử, chất lượng giữ nhờ `output_schema` |
| S7 | **Deploy Convex nằm trong build Vercel** | Loại bỏ cả một lớp lệch phiên bản giữa web và backend |
| S8 | **Kiểm duyệt trước khi sinh** | Chặn rác ở giá của một lời gọi flash thay vì cả pipeline |

### 9.2 Hạn chế và rủi ro

| # | Rủi ro | Mức độ | Chi tiết | Giảm thiểu đề xuất |
| --- | --- | --- | --- | --- |
| **R1** | `/api/queue-topic-request` **không kiểm tra phiên phía server** | 🔴 Cao | Route handler nhận `user_id` **từ thân request**; bất kỳ ai cũng có thể xếp hàng sinh nội dung với `user_id` tuỳ ý → lạm dụng chi phí + gán sai quyền sở hữu | `auth.api.getSession()` trong route; lấy `user_id` từ phiên, bỏ tham số từ client; rate-limit theo user |
| **R2** | **Trùng lặp khi QStash thử lại** | 🟠 Trung bình–cao | ADK trả non-200 *sau khi* tác tử 11 đã ghi xong → QStash thử lại → **module thứ hai được sinh và ghi** (tốn thêm 3–4 phút + chi phí). Mã nguồn đã ghi nhận đúng hiện tượng này trong một TODO ở `app.py` | Theo đúng TODO sẵn có: bảng `topic_generation_requests` khoá theo `qstash_message_id` với ba trạng thái `in progress / error / success` — thấy khoá đã `success` thì trả 200 ngay; kèm chống trùng theo `slug` trước `createTopic` |
| **R3** | **Hợp đồng Python ↔ Convex giữ bằng tay** | 🟠 Trung bình | Tên hàm dạng chuỗi; đổi schema chỉ vỡ lúc chạy, giữa pipeline | Sinh stub Python từ `_generated/api.d.ts` trong CI; thêm smoke test gọi thử từng mutation |
| **R4** | **Rò rỉ phiên ADK trên các nhánh lỗi** | 🟡 Thấp–trung bình | `delete_session()` **chỉ được gọi ở nhánh thành công**. Nếu `create_session` thất bại, `run_service` trả non-200, hoặc có ngoại lệ, hàm `return` sớm và **phiên ở lại vĩnh viễn trên ADK runtime** (cả `topic-checker` và `topic-generator` đều vậy — 4 nhánh return sớm trong 2 hàm) | Bọc mỗi lần chạy trong `try/finally` để luôn `delete_session()`; thêm job dọn phiên cũ theo `session_id` có timestamp |
| **R5** | **Nội dung sinh ra không được kiểm chứng nguồn** | 🟡 Thấp–trung bình (nhưng ảnh hưởng *niềm tin*) | `source_urls` do một tác tử sinh; không bước nào đối chiếu từng khẳng định với nguồn | Bước "kiểm chứng" hậu kỳ: tải nguồn, đối chiếu, gắn nhãn độ tin cậy; hoặc hiển thị nguồn kèm cảnh báo trên UI |

**Ba điểm chết kỹ thuật nhỏ (không phải rủi ro, nhưng nên dọn):**

- `generator_api/app.py` khởi tạo `ConvexClient(CONVEX_URL)` nhưng **không dùng ở đâu** — code chết. Hoặc xoá, hoặc dùng nó để thực hiện R2 (ghi trạng thái yêu cầu) ngay ở tầng Flask.
- `parse_json_from_markdown()` phải xử lý JSON bọc trong markdown: dấu hiệu cho thấy `output_schema` ở một số bước chưa ép được model trả JSON thuần. Nên chuyển các bước đó sang chế độ JSON có ràng buộc thay vì bóc tách hậu kỳ.
- Khối `if __name__ == '__main__':` chạy `app.run(host='0.0.0.0', port=10000, debug=True)` — chế độ **debug bật** không được dùng trong sản phẩm. Trên Render, đường chạy sản phẩm là Gunicorn (qua `requirements.txt`), nên đây là cấu hình dành cho phát triển; nên khoá bằng biến môi trường để không thể bật nhầm khi chạy trực tiếp.

### 9.3 Bài học thiết kế

1. **Hàng đợi không tự động cho bạn tính idempotent.** QStash *hứa* gọi ít nhất một lần; trách nhiệm chống trùng nằm ở bạn. WSIC đang thiếu phần này (R2).
2. **Ranh giới ngôn ngữ là ranh giới kiểu.** Chỗ dễ vỡ nhất trong một hệ đa ngôn ngữ luôn là nơi một ngôn ngữ gọi sang ngôn ngữ khác mà không có kiểm tra kiểu (R3).
3. **`output_schema` biến xác suất thành hợp đồng.** Ở những bước có schema chặt, ta có thể dùng model rẻ hơn mà không mất chất lượng — đó là ý tưởng kinh tế quan trọng nhất của pipeline.
4. **Vật chất hoá trạng thái suy diễn là cách rẻ để index.** `isTrending` được tính mỗi giờ thay vì tính lúc đọc, cho phép `searchIndex` lọc theo nó.
5. **Ngưỡng tương tự là quyết định sản phẩm.** `SIMILARITY_SCORE` quyết định kho nội dung được tái sử dụng hay sinh mới — nó nên ở cấu hình lúc chạy, không nên bị nhúng vào build (`NEXT_PUBLIC_*`).

---

## 10. Hướng phát triển

### 10.1 Giai đoạn 1 — Ổn định (ưu tiên cao, chi phí thấp)

| Việc | Vì sao |
| --- | --- |
| Xác thực `/api/queue-topic-request` + lấy `user_id` từ phiên | Đóng R1 — rủi ro lạm dụng chi phí |
| Bảng `topic_generation_requests` khoá theo `qstash_message_id` | Đóng R2 — chống sinh trùng, cũng là nền cho việc theo dõi tiến độ ở UI |
| Thông báo khi thất bại sau 3 lần thử | Hiện yêu cầu "biến mất im lặng" — lỗ hổng trải nghiệm rõ nhất |
| Xoá code chết `ConvexClient` hoặc dùng nó để ghi trạng thái yêu cầu | Dọn dẹp + phục vụ trực tiếp R2 |
| Bọc mỗi lần chạy agent trong `try/finally` để luôn xoá phiên ADK; tắt `debug=True` | Đóng R4; chặn tích luỹ phiên mồ côi trên Cloud Run |
| Sinh stub/smoke test Python ↔ Convex trong CI | Đóng R3 |

### 10.2 Giai đoạn 2 — Hiệu năng và chất lượng

| Việc | Vì sao |
| --- | --- |
| Chuyển tác tử 8–9–10 sang **`ParallelAgent`** (độc lập về dữ liệu) | Giảm thời gian sinh; đã ghi nhận trong `todo.md` |
| Tách `generate_embedding` thành bước có thể thử lại riêng, trước khi ghi | Tránh mất cả quy trình 3–4 phút vì bước cuối |
| Đưa `SIMILARITY_SCORE`, số lần thử, `retryDelay` ra biến môi trường lúc chạy | Điều chỉnh được mà không deploy |
| Telemetry từng tác tử (thời gian, tỉ lệ lỗi, token) | Cần trước khi tối ưu tiếp |
| Hiển thị trạng thái "đang brew" theo `qstashMessageId` trên UI | Trải nghiệm; thay vì chỉ có toast |

### 10.3 Giai đoạn 3 — Mở rộng

| Việc | Ghi chú |
| --- | --- |
| Kiểm chứng nguồn (grounding) cho mọi khẳng định | Đóng R5; có thể là tác tử thứ 12 hoặc bước hậu kỳ |
| Tìm kiếm ngữ nghĩa **bên trong** khối nội dung, không chỉ cấp chủ đề | Cần chiến lược chunking + chỉ mục riêng |
| Vòng lặp phản hồi (like/save/view → prompt) | Dữ liệu tương tác đã có trong `userTopicInteractions` |
| Đa ngôn ngữ, bắt đầu từ tiếng Việt | Bổ sung chỉ mục ngôn ngữ; hiện `search_topics` chỉ trên `title` |
| API công khai / kênh phân phối mới | Kiến trúc đã sẵn sàng: tầng AI không phụ thuộc giao diện |

---

## 11. Kết luận

WSIC chứng minh một luận điểm cụ thể: **với mô hình ngôn ngữ hiện nay, nội dung học tập có thể được sinh tại thời điểm nhu cầu phát sinh — nếu bài toán được chia đúng.** Ba yếu tố làm nên điều đó:

1. **Chia theo bước, không chia theo prompt:** 11 tác tử tuần tự với `output_schema` và `output_key`, thay vì một prompt khổng lồ.
2. **Chấp nhận độ trễ, nhưng che nó đi:** 3–4 phút là không thể tránh; hàng đợi + webhook + realtime biến nó thành "quay lại sau và mọi thứ đã sẵn sàng".
3. **Ranh giới rõ giữa ba tầng:** web có kiểm tra kiểu, Convex là nguồn chân lý về dữ liệu, Python là nơi duy nhất sinh nội dung.

Đổi lại, hệ thống có **một điểm yếu cấu trúc và bốn điểm yếu vận hành**. Điểm yếu cấu trúc — hợp đồng Python ↔ Convex giữ bằng tay — là đặc trưng của mọi hệ đa ngôn ngữ, và cách xử lý nằm ở **mã sinh tự động trong CI**, không phải ở kỷ luật của lập trình viên. Bốn điểm yếu còn lại (xác thực endpoint xếp hàng, chống trùng khi QStash thử lại, rò rỉ phiên ADK trên nhánh lỗi, và việc không kiểm chứng nguồn trước khi công bố) đều là **ngắn hạn, chi phí thấp, và nên làm trước mọi tính năng mới**. Riêng R2 đã có sẵn thiết kế sửa trong mã nguồn — điều còn thiếu chỉ là việc thực hiện.

---

## Phụ lục A — Bản đồ tài liệu và sơ đồ

| Loại | Tệp |
| --- | --- |
| **Kiến trúc (tĩnh) — C4** | [`c4-architecture.md`](./c4-architecture.md) + `diagrams/c4/` (6 sơ đồ: ngữ cảnh, container, component web, component Convex, component AI, mã nguồn) |
| **Kiến trúc chi tiết** | [`architecture.md`](./architecture.md) (nguồn chân lý về hệ thống) |
| **Luồng động** | `diagrams/01-tong-quan.png` · `02-luong-sinh-noi-dung.png` · `03-multi-agent.png` · `04-tim-kiem.png` · `05-xac-thuc.png` |
| **Dữ liệu** | `diagrams/06-mo-hinh-du-lieu.png` · `07-so-sanh-va-chuyen-doi.png` |
| **Chuyên đề** | [`topic-generation.md`](./topic-generation.md) · [`search-system.md`](./search-system.md) |
| **Quy ước mã nguồn** | `.kiro/steering/agents_rules.md` · `.kiro/steering/convex_rules.md` |
| **Kế hoạch** | `todo.md` |

Mã nguồn sơ đồ C4 nằm ở `docs/diagrams/c4/src/*.dot` — vẽ lại (cần Graphviz):

```bash
cd docs/diagrams/c4
for f in src/*.dot; do base=$(basename "$f" .dot); dot -Tsvg "$f" -o "$base.svg"; dot -Tpng -Gdpi=140 "$f" -o "$base.png"; done
```

## Phụ lục B — Thuật ngữ

| Thuật ngữ | Nghĩa trong tài liệu này |
| --- | --- |
| **Brew** | Hành động yêu cầu hệ thống sinh một module học tập mới cho một chủ đề |
| **Module** | Một chủ đề cùng toàn bộ 7 khối nội dung của nó |
| **Tác tử (agent)** | Một `LlmAgent` của Google ADK, một bước trong pipeline |
| **`output_key`** | Khoá trong state dùng chung mà tác tử ghi kết quả vào |
| **`output_schema`** | Kiểu Pydantic mà tác tử bị buộc phải trả về |
| **ADK** | Agent Development Kit của Google |
| **Container (C4)** | Một đơn vị triển khai (process/tiến trình) — không phải container Docker |
| **Component (C4)** | Một nhóm chức năng có ranh giới trong một container |

---

*Tài liệu này mô tả đúng trạng thái mã nguồn tại commit được ghi ở trên đầu trang lịch sử Git. Khi `convex/schema.ts` hoặc pipeline tác tử thay đổi, các mục §5, §6 và §7 cần được cập nhật tương ứng.*
