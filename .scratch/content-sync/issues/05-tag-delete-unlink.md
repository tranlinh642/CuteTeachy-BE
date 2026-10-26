# S3-BE-05: Xoá Tag thì gỡ khỏi Task và Note

**What to build:** Khi giáo viên xoá một Tag, Tag biến mất khỏi mọi Task và Note đang gắn, và các thiết bị khác thấy thay đổi đó qua đồng bộ chênh lệch.

**Blocked by:** S3-BE-03, S3-BE-04

**Status:** done

**Đọc:** SPEC-003 mục *Quy tắc đồng bộ chung* (thay đổi gián tiếp), *API* (tags); `docs/architecture/design-patterns.md` (Unit of Work).

**Vùng sở hữu:** use case xoá Tag (mở rộng của S3-BE-01), port Unit of Work + adapter Prisma nếu chưa có.

- [x] Xoá Tag, gỡ liên kết khỏi mọi Task/Note của giáo viên và cập nhật `updatedAt` của chúng — tất cả trong **một transaction** (lỗi giữa chừng → không thay đổi gì). (Kiểm tra qua unit test rollback với FakeUnitOfWork và e2e test với PrismaUnitOfWork)
- [x] Sau xoá: `GET /tasks?updatedSince` và `GET /notes?updatedSince` trả các bản ghi bị ảnh hưởng với `tagIds` đã gỡ. (Kiểm tra qua e2e test tags.e2e-spec.ts)
- [x] Unit test use case với fake Unit of Work; e2e kiểm cả hai danh sách; gate xanh, dán output. (check-types, lint, test: 62 suites/357 tests, test:e2e: 10 suites/120 tests đều xanh)
