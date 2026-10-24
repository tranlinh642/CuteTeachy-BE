# S3-BE-05: Xoá Tag thì gỡ khỏi Task và Note

**What to build:** Khi giáo viên xoá một Tag, Tag biến mất khỏi mọi Task và Note đang gắn, và các thiết bị khác thấy thay đổi đó qua đồng bộ chênh lệch.

**Blocked by:** S3-BE-03, S3-BE-04

**Status:** ready-for-agent

**Đọc:** SPEC-003 mục *Quy tắc đồng bộ chung* (thay đổi gián tiếp), *API* (tags); `docs/architecture/design-patterns.md` (Unit of Work).

**Vùng sở hữu:** use case xoá Tag (mở rộng của S3-BE-01), port Unit of Work + adapter Prisma nếu chưa có.

- [ ] Xoá Tag, gỡ liên kết khỏi mọi Task/Note của giáo viên và cập nhật `updatedAt` của chúng — tất cả trong **một transaction** (lỗi giữa chừng → không thay đổi gì).
- [ ] Sau xoá: `GET /tasks?updatedSince` và `GET /notes?updatedSince` trả các bản ghi bị ảnh hưởng với `tagIds` đã gỡ.
- [ ] Unit test use case với fake Unit of Work; e2e kiểm cả hai danh sách; gate xanh, dán output.
