# BE-02: Scaffold NestJS + Prisma theo Clean Architecture

**What to build:** Một BE NestJS chạy được ở cổng 4000, kết nối Postgres qua Prisma, có `GET /health`, đúng khung 4 layer + composition, lint chặn import sai layer, lỗi trả theo dạng `{ code, message }`, và chạy được bằng Docker (service `api`).

**Blocked by:** BE-01

**Status:** ready-for-agent

**Đọc:** `AGENTS.md`, `docs/architecture/layers.md`, `dependency-injection.md`, `testing.md`; SPEC-002 mục *API Contract* (dạng lỗi).

**Vùng sở hữu:** bootstrap (`main`, app module, shared module), thư mục `shared` của mọi layer, cấu hình TypeScript/ESLint/Prettier/test, Prisma setup (chưa có model nghiệp vụ), Dockerfile, service `api` trong compose, mục lệnh trong `AGENTS.md`.

- [ ] TypeScript strict, pnpm, Node ≥ 22.
- [ ] Cây thư mục `domain/ application/ infrastructure/ presentation/ composition/` đúng `layers.md`.
- [ ] ESLint `no-restricted-imports` theo layer như `layers.md`; chứng minh bằng cách tạm thêm một import sai vào `domain` → lint đỏ (ghi output), rồi gỡ.
- [ ] `DomainError` (có `code`) + global exception filter: lỗi domain → status theo bảng map duy nhất; lỗi validation → `400 { code: 'validation' }`; lỗi không lường trước → `500 { code: 'unknown' }`, không lộ stack.
- [ ] Config đọc env một lần, validate bằng schema, thiếu biến bắt buộc → app không khởi động và báo rõ biến nào.
- [ ] Port dùng chung `CLOCK`, `ID_GENERATOR` + adapter, đăng ký trong shared module.
- [ ] CORS chỉ cho `FE_URL`.
- [ ] `GET /health` trả 200 khi DB kết nối được, 503 khi không.
- [ ] Test runner cho unit và e2e; một unit test mẫu với fake port, một e2e cho `/health` dùng Postgres từ compose.
- [ ] Dockerfile multi-stage; `docker compose --profile app up` chạy được `api` và `/health` = 200.
- [ ] Ghi lệnh dev/build/type-check/lint/test/e2e/migrate vào `AGENTS.md` (thay `[CẦN BỔ SUNG …]`).
