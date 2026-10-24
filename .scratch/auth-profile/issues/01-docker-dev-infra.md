# BE-01: Hạ tầng dev bằng Docker Compose

**What to build:** Một lệnh `docker compose up -d` dựng đủ hạ tầng dev cho BE: Postgres, MinIO (kèm bucket `avatars` đọc công khai) và Mailpit, để mọi ticket sau có DB, object storage và hộp thư giả để chạy e2e.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Đọc:** SPEC-002 mục *Hạ tầng dev* (`../CuteTeachy-FE/docs/specs/SPEC-002-auth-google-onboarding-avatar.md`).

**Vùng sở hữu:** file compose, `.env.example`, `.gitignore` của BE, mục "Chạy hạ tầng dev" trong README BE.

- [ ] `postgres` bản 16, có healthcheck, dữ liệu trong named volume, cổng 5432.
- [ ] `minio` có healthcheck, cổng API 9000 và console 9001, dữ liệu trong named volume.
- [ ] `minio-init` chạy một lần sau khi `minio` healthy: tạo bucket `avatars` (idempotent) và cho đọc ẩn danh; chạy lại không lỗi.
- [ ] `mailpit`: SMTP 1025, web UI 8025.
- [ ] Mọi credential đọc từ `.env`; `.env.example` liệt kê đủ biến cho cả các ticket sau (DB, JWT, Google OAuth, FE_URL, MinIO, SMTP, `EMAIL_VERIFICATION_REQUIRED=false`, TTL refresh token) với giá trị dev giả, không có secret thật.
- [ ] `.env` nằm trong `.gitignore`.
- [ ] Chừa chỗ cho service `api` dưới profile `app` (BE-02 điền vào).
- [ ] Kiểm chứng: `docker compose up -d` → mọi service healthy; `curl` đọc ẩn danh một object thử trong `avatars` trả 200; mở được Mailpit UI. Dán output vào báo cáo.
