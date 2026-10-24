# Layers & Dependency Rule

Single source of truth cho cấu trúc thư mục và hướng import của CuteTeachy-BE.

## Cây thư mục chuẩn

```
src/
├── main.ts                         # bootstrap Nest, global pipe/filter, CORS
├── domain/
│   ├── shared/                     # DomainError, Entity base (nếu cần), Id type
│   ├── task/                       # task.entity.ts, task-priority.vo.ts, task.errors.ts
│   ├── note/
│   ├── tag/
│   └── user/                       # user.entity.ts, gender.vo.ts, theme-preference.vo.ts
├── application/
│   ├── shared/ports/               # clock.port.ts, id-generator.port.ts, unit-of-work.port.ts
│   └── task/
│       ├── ports/                  # task.repository.port.ts (interface + TOKEN)
│       ├── create-task.use-case.ts
│       ├── complete-task.use-case.ts
│       └── task.dto.ts             # Input/Output type của use case (plain TS)
├── infrastructure/
│   ├── persistence/prisma/
│   │   ├── prisma.service.ts
│   │   ├── prisma-unit-of-work.ts
│   │   ├── mappers/task.mapper.ts  # Prisma row ↔ Task entity
│   │   └── repositories/prisma-task.repository.ts
│   ├── auth/                       # jwt-token.service.ts, argon2-password-hasher.ts, google-oauth.client.ts
│   ├── storage/minio-object-storage.ts
│   ├── notification/web-push.notifier.ts
│   ├── system/system-clock.ts
│   └── config/                     # đọc & validate env, export typed config
├── presentation/http/
│   ├── task/
│   │   ├── task.controller.ts
│   │   ├── task.request.ts         # schema validate body/query
│   │   └── task.response.ts        # response DTO + mapper từ use-case output
│   ├── auth/auth.guard.ts          # verify token → gắn userId vào request
│   └── filters/domain-error.filter.ts
└── composition/
    ├── app.module.ts
    ├── shared.module.ts            # Clock, IdGenerator, Prisma, UnitOfWork
    └── task.module.ts              # bind TASK_REPOSITORY → PrismaTaskRepository, đăng ký use case
```

Feature = thư mục cùng tên (`task`, `note`, `tag`, `user`, `notification`) lặp lại trong từng layer. Thêm feature mới = tạo đủ các thư mục tương ứng, không gộp feature vào `shared/`.

`shared/` chỉ chứa thứ ≥ 2 feature dùng thật.

## Bảng import được phép

| Từ \ Tới | domain | application | infrastructure | presentation | composition | `@nestjs/*` | `@prisma/client` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| domain | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| application | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| infrastructure | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| presentation | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| composition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

Presentation không gọi repository hay Prisma trực tiếp — luôn qua use case.

## Trách nhiệm từng layer

### domain
- Entity giữ invariant: constructor `private`, tạo qua `static create(props)` (validate, throw `DomainError`) và `static reconstitute(props)` (load từ DB, không validate lại).
- Value Object bất biến, so sánh theo giá trị.
- Ví dụ rule thuộc domain (GLOSSARY "Smart Default Theme"): `User.changeGender(newGender)` reset `themePreference` về `'auto'` khi `newGender !== prevGender`. Rule này không được nằm ở controller hay repository.

### application
- Use case điều phối: load entity qua port → gọi method domain → lưu qua port → trả Output DTO (plain object, không trả entity ra ngoài).
- Port = `interface` + `export const X_TOKEN = Symbol('X')` trong cùng file.
- Kiểm tra quyền sở hữu (`task.userId === input.userId`) ở đây.

### infrastructure
- Implement port. Được dùng `@Injectable()`, Prisma, SDK bên thứ ba.
- Mapper chuyển đổi hai chiều; Prisma type không rò ra khỏi thư mục `persistence/`.
- Config: đọc `process.env` một lần, validate bằng schema, export object có kiểu. Layer khác nhận config qua DI.

### presentation
- Validate request bằng schema, map sang Input của use case, gọi `execute`, map Output sang response DTO.
- Không chứa `if` nghiệp vụ.

### composition
- Nest `@Module` khai báo provider, bind token → adapter, đăng ký use case bằng `useFactory`. Xem [`dependency-injection.md`](dependency-injection.md).

## Enforce bằng lint (cài khi scaffold)

Dùng rule ESLint core `no-restricted-imports`, mỗi layer một config object có `files` riêng trong flat config:

```js
// eslint.config.js (trích)
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      { group: ['**/application/**', '**/infrastructure/**', '**/presentation/**', '**/composition/**'], message: 'domain chỉ import domain' },
      { group: ['@nestjs/*', '@prisma/*', 'express'], message: 'domain phải framework-free' },
    ]}],
  },
},
{
  files: ['src/application/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      { group: ['**/infrastructure/**', '**/presentation/**', '**/composition/**'], message: 'application chỉ import domain/application' },
      { group: ['@nestjs/*', '@prisma/*', 'express'], message: 'application phải framework-free' },
    ]}],
  },
},
{
  files: ['src/presentation/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      { group: ['**/infrastructure/**', '**/composition/**', '@prisma/*'], message: 'presentation đi qua use case' },
    ]}],
  },
},
```

Vi phạm layer phải đỏ trên lint, không phụ thuộc vào review thủ công.
