# Sơ đồ kiến trúc (Architecture diagrams)

Thư mục này chứa các sơ đồ kiến trúc của WSIC, được vẽ bằng **Graphviz (DOT)** và xuất ra **SVG + PNG**.

| Sơ đồ | Nội dung |
| --- | --- |
| `01-tong-quan` | Kiến trúc tổng quan: người dùng, Vercel/Next.js, Convex, PostgreSQL, QStash, Render, Cloud Run, dịch vụ AI |
| `02-luong-sinh-noi-dung` | Luồng “Brew your topic”: từ tìm kiếm → QStash → Flask → agent → ghi Convex → thông báo realtime |
| `03-multi-agent` | Pipeline 11 sub-agent của `OrchestratorAgent` (Google ADK) |
| `04-tim-kiem` | Hệ thống tìm kiếm hai nhánh: full-text (`convex/search.ts`) + vector ngữ nghĩa (`convex/embeddings.ts`) |
| `05-xac-thuc` | Xác thực & phân quyền: Better Auth, PostgreSQL, `lib/auth.ts`, `proxy.ts`, `app/api/health/auth` |
| `06-mo-hinh-du-lieu` | Mô hình dữ liệu Convex (`convex/schema.ts`) và các bảng PostgreSQL của better-auth |
| `07-frontend` | Cấu trúc route, layout và providers của Next.js App Router |

Mỗi sơ đồ có 3 tệp: `<tên>.png` (ảnh nhúng tài liệu), `<tên>.svg` (bản vector, xem rõ khi phóng to) và `src/<tên>.dot` (mã nguồn Graphviz).

## Vẽ lại sơ đồ

```bash
# Cài Graphviz nếu chưa có:  apt-get install -y graphviz   (hoặc: brew install graphviz)

cd docs/diagrams
for f in src/*.dot; do
  base=$(basename "$f" .dot)
  dot -Tsvg "$f" -o "$base.svg"
  dot -Tpng -Gdpi=140 "$f" -o "$base.png"
done
```

Không cần cài gì thêm — sơ đồ nguồn chỉ dùng cú pháp Graphviz thuần (bảng HTML trong nhãn, cluster, cổng màu).
