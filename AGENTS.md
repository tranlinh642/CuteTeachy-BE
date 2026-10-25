# CuteTeachy-BE — Agent Rules

Backend API cho CuteTeachy (Serene Educator): Tasks & Schedule, Notes & To-Dos, Tags, User & Settings, Push Notification. Nghiệp vụ: [`docs/ba/`](docs/ba/), thuật ngữ: [`../CuteTeachy-FE/GLOSSARY.md`](../CuteTeachy-FE/GLOSSARY.md).

**Stack (đã chốt):** NestJS + TypeScript (strict) · Prisma · Supabase PostgreSQL (chỉ dùng làm database) · Auth do BE tự quản lý (tài khoản email/mật khẩu + Google OAuth, BE tự phát token) · Lưu file qua port `ObjectStorage` chuẩn S3: MinIO khi dev, Cloudflare R2 production · Email: Mailpit khi dev, Gmail SMTP (App Password) production. Cấu hình dịch vụ ngoài: [`docs/setup/external-services.md`](docs/setup/external-services.md).
**Trạng thái:** đã scaffold (BE-02). Lệnh: dev (`pnpm dev`), build (`pnpm build`), type-check (`pnpm check-types`), lint (`pnpm lint`), unit test (`pnpm test`), e2e test (`pnpm test:e2e`), prisma validate/generate (`pnpm prisma:generate`), migrate (`pnpm prisma:migrate`).
**Deploy:** Vercel serverless ([ADR 0005](docs/adr/0005-serverless-on-vercel.md)) — không giữ trạng thái trong bộ nhớ giữa các request (rate limit, OAuth state, lịch chạy đều phải bền qua DB hoặc token có ký).

## Kiến trúc: Clean Architecture, 4 layer toàn cục + Composition Root

```
src/domain/          Entity, Value Object, DomainError — TypeScript thuần
src/application/     Use case + Port (interface + DI token)
src/infrastructure/  Adapter: Prisma repository, mapper, JWT/password hasher, Google OAuth, MinIO, web-push, config
src/presentation/    HTTP: controller, request/response DTO, guard, exception filter
src/composition/     Nest @Module — nơi DUY NHẤT bind Port → Adapter
```

**Dependency rule** — mũi tên import chỉ hướng vào trong:

- `domain` → không import layer nào khác, không import package framework/IO.
- `application` → chỉ `domain`.
- `infrastructure`, `presentation` → `application` + `domain`.
- `composition` → mọi layer.

`domain/` và `application/` giữ framework-free: không có `@nestjs/*`, `@prisma/client`, `express`, `process.env`. Chi tiết, bảng import, ví dụ: [`docs/architecture/layers.md`](docs/architecture/layers.md).

## Rule cứng

1. Business rule sống trong entity/value object (`domain`), luồng nghiệp vụ trong use case (`application`). Controller chỉ: validate input → gọi 1 use case → map response.
2. Mỗi use case = 1 class, 1 method public `execute(input)`, nhận dependency qua constructor.
3. Repository trả về domain entity; Prisma model và response DTO chỉ đi qua mapper.
4. Mọi dependency ra ngoài process (DB, auth, push, clock, id generator) đi qua Port có DI token `Symbol`.
5. Lỗi nghiệp vụ = subclass `DomainError` có `code`; global exception filter map sang HTTP status.
6. `userId` lấy từ token đã verify ở guard, truyền vào use case như input; mọi query lọc theo `userId`.
7. Thêm abstraction (port, strategy, base class) khi có ≥ 2 adapter thật hoặc là ranh giới IO — test fake được tính là adapter thứ hai.

## Tài liệu tham chiếu — đọc khi chạm nhánh tương ứng

- **Tạo/di chuyển file, thêm feature, nghi ngờ vi phạm layer** → [`layers.md`](docs/architecture/layers.md)
- **Thêm port, bind provider, sửa `@Module`, scope, config** → [`dependency-injection.md`](docs/architecture/dependency-injection.md)
- **Chọn pattern (Repository, Mapper, Factory, Unit of Work, Strategy, Adapter)** → [`design-patterns.md`](docs/architecture/design-patterns.md)
- **Viết test, fake port, e2e** → [`testing.md`](docs/architecture/testing.md)
- **Refactor, rename, extract, move, review diff** → [`refactoring.md`](docs/architecture/refactoring.md)

## Chọn skill theo tình huống

| Tình huống | Skill |
| --- | --- |
| Không rõ nên đi flow nào | `ask-matt` |
| Feature mới / ý tưởng còn mờ | `grill-with-docs` → `to-spec` → `to-tickets` |
| Implement 1 ticket / 1 hành vi | `implement`, lái bằng `tdd` |
| Thiết kế interface của module/port | `codebase-design` |
| Tìm điểm làm sâu module, dọn kiến trúc | `improve-codebase-architecture` |
| Thuật ngữ mới, quyết định khó đảo ngược (ADR) | `domain-modeling` |
| Trước khi sửa một symbol đã tồn tại | `gitnexus-impact-analysis` |
| Rename / extract / split / move | `gitnexus-refactoring` |
| Bug khó, flaky, regression | `diagnosing-bugs` (+ `gitnexus-debugging`) |
| Review diff/branch | `code-review` |
| Viết PR | `pr` |

GitNexus chỉ hoạt động khi BE là git repo đã được index — thiết lập theo skill `gitnexus-cli`.

## Definition of Done

- Không có import vi phạm dependency rule (lint `no-restricted-imports` xanh, xem `layers.md`).
- Use case mới có unit test chạy với fake port, không cần Nest/DB.
- Type-check, lint, test xanh — báo cáo kèm output lệnh thật.
- Thuật ngữ mới đã có trong `../CuteTeachy-FE/GLOSSARY.md` (glossary dùng chung); quyết định kiến trúc mới đã có ADR trong `docs/adr/`.
