# S3-BE-03: Tasks

**What to build:** Giáo viên tạo, xem theo khoảng ngày, sửa, tick hoàn thành và xoá Task; gửi lại khi offline không tạo trùng; mở app chỉ tải Task thay đổi.

**Blocked by:** S3-BE-01

**Status:** ready-for-agent

**Đọc:** SPEC-003 mục *Quy tắc đồng bộ chung*, *Kiểu dữ liệu* (Task), *API* (tasks); `GLOSSARY.md`.

**Vùng sở hữu:** feature `task` ở mọi layer; migration Task + liên kết Task–Tag. Dùng lại (không sửa) thành phần đồng bộ của S3-BE-01.

- [ ] Validation: `title` 1–120, `notes` ≤ 1000, `date` YYYY-MM-DD, `time` HH:mm tùy chọn, `category ∈ {school, personal}`, `priority ∈ {normal, high}` mặc định `normal`, ≤ 10 `tagIds` và mỗi Tag thuộc chính giáo viên, chưa xoá → sai: `400 validation`.
- [ ] `POST /tasks` theo quy tắc tạo idempotent chung (`201`/`200`/`410`/`409 id_conflict`).
- [ ] `GET /tasks?from&to[&updatedSince]`: `from`, `to` bắt buộc, khoảng ≤ 42 ngày (vượt → `400`); envelope; `deletedIds` gồm Task bị xoá sau mốc.
- [ ] `PATCH /tasks/:id` từng phần, last-write-wins; Task đã xoá/của người khác → `404`.
- [ ] `DELETE /tasks/:id` xoá mềm, lặp lại `204`.
- [ ] e2e cho các nhánh trên, gồm quyền sở hữu; gate xanh, dán output.
