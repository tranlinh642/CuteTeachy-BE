# S3-BE-01: Tags + nền đồng bộ chung

**What to build:** Giáo viên tạo, xem, đổi tên/màu và xoá Tag; danh sách Tag đồng bộ được theo phần chênh lệch. Ticket này đặt **nền đồng bộ dùng chung** (envelope danh sách, tạo idempotent, xoá mềm, `updatedSince`, quyền sở hữu) mà mọi tài nguyên sau tái dùng.

**Blocked by:** auth-profile BE-04 (Onboarding guard)

**Status:** in-progress

**Đọc:** SPEC-003 mục *Quy tắc đồng bộ chung*, *Kiểu dữ liệu* (Tag), *API* (tags), *Module BE*; ADR BE 0003; `AGENTS.md`.

**Vùng sở hữu:** feature `tag` ở mọi layer; thành phần đồng bộ dùng chung trong `shared` (envelope, quy tắc tạo/xoá mềm, kiểm `updatedSince`); use case dọn dấu xoá quá 30 ngày + lệnh chạy tay; migration cho Tag.

- [ ] `POST /tags` tạo idempotent: mới `201`; lặp cùng `id` `200` trả bản hiện có; `id` đã xoá mềm `410 gone`; `id` của giáo viên khác `409 id_conflict`.
- [ ] Tên 1–24 ký tự sau trim; trùng tên trong phạm vi giáo viên (không phân biệt hoa thường, bỏ qua Tag đã xoá) → `409 tag_name_taken`, áp dụng cả `PATCH`.
- [ ] `PATCH /tags/:id` đổi `name`/`tone`; Tag đã xoá hoặc của người khác → `404`.
- [ ] `DELETE /tags/:id` xoá mềm, lặp lại `204`. (Gỡ khỏi Task/Note làm ở S3-BE-05.)
- [ ] `GET /tags[?updatedSince]` trả envelope `{ items, deletedIds, serverTime }`; `updatedSince` cũ hơn 30 ngày → `400 validation`.
- [ ] Thành phần đồng bộ dùng chung có một nơi duy nhất, có unit test riêng, sẵn cho Task/Note/Timetable dùng lại.
- [ ] Lệnh dọn dấu xoá quá 30 ngày chạy tay được (dùng `Clock`), có test.
- [ ] e2e cho mọi nhánh trên; gate theo `AGENTS.md` xanh, dán output.
