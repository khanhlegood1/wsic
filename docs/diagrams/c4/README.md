# Sơ đồ C4 — WSIC

Bộ sơ đồ kiến trúc theo **mô hình C4**, mỗi cấp một mức trừu tượng:

| Cấp | Tệp | Nội dung |
| --- | --- | --- |
| 1 · Context | `c4-1-context.png` · `.svg` | Hai tác nhân, WSIC, năm hệ thống ngoài (Gemini, Exa, Serper, Google Identity, QStash) |
| 2 · Container | `c4-2-container.png` · `.svg` | Sáu container: ứng dụng web, Convex, PostgreSQL, generator_api, topic-checker, topic-generator |
| 3 · Component | `c4-3-components-web.png` · `.svg` | Bên trong ứng dụng Next.js: proxy, route máy chủ, hooks, providers… |
| 3 · Component | `c4-3-components-convex.png` · `.svg` | Bên trong Convex: 4 kiểu client × 4 miền module |
| 3 · Component | `c4-3-components-agents.png` · `.svg` | `topic-checker` + `OrchestratorAgent` và 11 sub-agent |
| 4 · Code | `c4-4-code.png` · `.svg` | Bản đồ tệp & ký hiệu chính của toàn bộ mã nguồn |

Mô tả kèm bảng tra cứu: [`../../c4-architecture.md`](../../c4-architecture.md).

## Mã nguồn Graphviz

`src/*.dot` — nhãn dùng thẻ HTML của Graphviz, tô màu theo quy ước C4:

| Ký hiệu | Màu |
| --- | --- |
| Person | `#08427b` (xanh đậm) |
| Hệ thống / container của WSIC | `#1168bd` · `#438dd5` (xanh dương) |
| Component | `#85bbf0` (xanh nhạt) — trong ảnh dùng các sắc độ của `#a9d0f5`, `#f5c78a`, `#9bd6a6`, `#d3b6f2`, `#c9c9c9` để phân biệt **miền** ở cấp 3–4 |
| Hệ thống bên ngoài | `#999999` (xám) |
| Ranh giới (boundary) | `#8a8a8a`, nét đứt |

Các nút màu xám hoặc đỏ trên sơ đồ cấp 3 đánh dấu **rủi ro đã biết** (ví dụ: client Python gọi Convex bằng tên chuỗi; route xếp hàng chưa xác thực). Xem §9.2 của [`../../whitepaper.md`](../../whitepaper.md).

## Vẽ lại

Cần [Graphviz](https://graphviz.org/download/):

```bash
cd docs/diagrams/c4
for f in src/*.dot; do
  base=$(basename "$f" .dot)
  dot -Tsvg "$f" -o "$base.svg"
  dot -Tpng -Gdpi=140 "$f" -o "$base.png"
done
```

Không có Graphviz nhưng có Node.js (dùng WebAssembly + sharp):

```bash
npm i @hpcc-js/wasm-graphviz sharp
node -e '
const fs=require("fs"),{Graphviz}=require("@hpcc-js/wasm-graphviz"),sharp=require("sharp");
(async()=>{const gv=await Graphviz.load();
for(const f of fs.readdirSync("src").filter(f=>f.endsWith(".dot"))){
  const svg=gv.dot(fs.readFileSync("src/"+f,"utf8")),b=f.replace(/\.dot$/,"");
  fs.writeFileSync(b+".svg",svg);
  await sharp(Buffer.from(svg),{density:200}).png().toFile(b+".png");
}})()'
```

## Ghi chú về bố cục

- `c4-3-components-agents` rất cao (≈ 2566 × 3336 px) vì xếp 11 tác tử theo chiều dọc — chủ ý, để đọc được trên màn hình dọc và trong ảnh chia sẻ.
- Không dùng `ratio` hay cụm lồng nhau ở cấp 3b–3c (đã thử và tạo ra "mì spaghetti"); thay vào đó dùng dải `{rank=same}` + chuỗi cạnh ẩn `weight=20` để kiểm soát thứ tự dải.
- Tránh `<HR/>`, emoji và `<span href>` trong nhãn Graphviz — chúng không render ổn định qua các phiên bản.
