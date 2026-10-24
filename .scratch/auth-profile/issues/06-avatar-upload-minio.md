# BE-06: Upload và xoá avatar lên MinIO

**What to build:** Giáo viên upload ảnh đại diện (jpeg/png/webp, ≤ 2 MB) hoặc xoá ảnh; `avatarUrl` trong `User` trỏ tới URL công khai trên MinIO. Code chỉ phụ thuộc port `ObjectStorage` chuẩn S3 để đổi nhà cung cấp sau này.

**Blocked by:** BE-03

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Avatar*, *API Contract* (`/auth/profile/avatar`); `docs/architecture/design-patterns.md` (Adapter).

**Vùng sở hữu:** feature `avatar` (use case upload/xoá), port `ObjectStorage` + adapter MinIO, controller `/auth/profile/avatar`. Không sửa use case cập nhật Profile của BE-04.

- [ ] `POST /auth/profile/avatar` (multipart `file`) → `200 User` có `avatarUrl` mới.
- [ ] > 2 MB → `413 file_too_large`; kiểu khác jpeg/png/webp (kiểm magic bytes) → `415 unsupported_file_type`.
- [ ] Object key ngẫu nhiên trong bucket `avatars`; ảnh cũ do hệ thống quản lý bị xoá sau khi ảnh mới lưu thành công; avatar Google (URL ngoài) không bị xoá trên storage.
- [ ] `DELETE /auth/profile/avatar` → `200 User` không còn `avatarUrl`.
- [ ] URL công khai dựng từ config (endpoint public của MinIO khi dev, của Cloudflare R2 production — xem `docs/setup/external-services.md` §3), không hard-code; cùng một adapter S3 chạy được với cả hai chỉ bằng đổi biến môi trường.
- [ ] Unit test với fake `ObjectStorage`; e2e upload → GET URL công khai trả đúng ảnh, dùng MinIO từ compose.
