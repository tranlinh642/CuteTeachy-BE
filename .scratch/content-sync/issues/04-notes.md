# S3-BE-04: Notes — phân trang, tìm kiếm không dấu, `completed` theo checklist

**What to build:** Giáo viên tạo, sửa, xoá Note có checklist; danh sách tải dần theo cursor, tìm bằng tiếng Việt không dấu và lọc theo Tag ở BE; Note tự hoàn thành khi mọi mục checklist đã tick.

**Blocked by:** S3-BE-01

**Status:** done

**Đọc:** SPEC-003 mục *Quy tắc đồng bộ chung*, *Kiểu dữ liệu* (Note), *API* (notes), *Quy tắc domain* (Note `completed`, tìm kiếm).

**Vùng sở hữu:** feature `note` ở mọi layer; migration Note + checklist + liên kết Note–Tag; chuẩn hoá chuỗi tìm kiếm không dấu.

- [x] Validation: `title` 1–120, `content` ≤ 5000, checklist ≤ 100 mục (mỗi mục có `id` client sinh, `text` không rỗng), ≤ 10 `tagIds` thuộc giáo viên, `dueDate` hợp lệ → sai: `400 validation`.
- [x] Quy tắc `completed` nằm trong domain Note: checklist không rỗng → `completed` = mọi mục `done` (bỏ qua giá trị client); rỗng → theo client. Unit test đủ các nhánh.
- [x] `POST`/`PATCH`/`DELETE` theo quy tắc chung; `checklist` trong `PATCH` thay toàn bộ.
- [x] `GET /notes?limit&cursor&q&tagId`: sắp `updatedAt` giảm dần, `limit` mặc định 20 tối đa 50, cursor ổn định (không trùng/không sót khi duyệt hết), trả `nextCursor`.
- [x] Tìm kiếm không dấu, không phân biệt hoa thường, `đ` ≡ `d`, trên tiêu đề + nội dung + text checklist; unit test cho hàm chuẩn hoá.
- [x] `GET /notes?updatedSince` trả envelope chênh lệch; dùng cùng `cursor`/`q`/`tagId` → `400 validation`.
- [x] e2e cho các nhánh trên; gate xanh, dán output.
