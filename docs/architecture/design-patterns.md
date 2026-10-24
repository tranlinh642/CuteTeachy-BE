# Design Patterns

Mỗi pattern ghi rõ: **dùng ở đâu**, **khi nào dùng**, **khi nào chưa cần**. Pattern là công cụ để tạo deep module (xem skill `codebase-design`): interface nhỏ, nhiều hành vi phía sau, test được qua chính interface đó.

## Bắt buộc dùng

### Repository — `application/*/ports` (port) + `infrastructure/persistence` (adapter)
- Một repository cho mỗi aggregate root (`Task`, `Note`, `Tag`, `User`).
- Method đặt theo nhu cầu use case: `findByDateRange(userId, from, to)` thay vì `findMany(where)` tổng quát.
- Input/Output là domain entity hoặc primitive. Prisma type ở lại trong adapter.

### Data Mapper — `infrastructure/persistence/prisma/mappers` và `presentation/http/*/*.response.ts`
- `TaskMapper.toDomain(row)` dùng `Task.reconstitute`; `TaskMapper.toPersistence(task)` trả object cho Prisma.
- Presentation có mapper riêng từ Output DTO → response JSON. Đổi schema DB hoặc đổi API contract chỉ chạm một mapper.

### Use Case (Command/Query) — `application/*/*.use-case.ts`
- Một class = một hành động người dùng (`CreateTask`, `CompleteTask`, `GetWeeklySchedule`).
- Đặt tên `<Động từ><Danh từ>UseCase`, method duy nhất `execute(input): Promise<Output>`.
- Query thuần đọc vẫn là use case, để controller luôn có một lối vào nhất quán.

### Factory Method trên Entity — `domain/*/*.entity.ts`
- `create()` cho dữ liệu mới (validate invariant), `reconstitute()` cho dữ liệu đã lưu.
- Constructor `private` để mọi entity hợp lệ ngay từ lúc sinh ra.

### Value Object — `domain/*/*.vo.ts`
- Cho khái niệm có rule riêng: `Gender` (`female|male|other`), `ThemePreference`, `TaskPriority`, `TimeRange` (start < end), `TagColor`.
- Bất biến; method trả instance mới.

### Adapter — `infrastructure/*`
- Bọc mọi SDK bên thứ ba sau một port: `TokenService` (ký/verify JWT), `PasswordHasher`, `GoogleOAuthClient`, `ObjectStorage` (MinIO/S3), `PushNotifier` (web-push / FCM), `Clock`, `IdGenerator`.
- Adapter dịch lỗi SDK sang lỗi của port; use case không thấy exception của SDK.

### Domain Error + Exception Filter — `domain/*/*.errors.ts`, `presentation/http/filters`
- `class TaskNotFoundError extends DomainError { code = 'TASK_NOT_FOUND' }`.
- Filter global map `code` → HTTP status (NotFound → 404, Validation → 422, Forbidden → 403). Bảng map đặt ở một chỗ duy nhất trong filter.

## Dùng khi điều kiện xảy ra

### Unit of Work — `application/shared/ports/unit-of-work.port.ts`
**Khi:** một use case ghi ≥ 2 aggregate cần atomic (ví dụ xoá Tag và gỡ Tag khỏi mọi Task/Note).

```ts
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
```

Adapter `PrismaUnitOfWork` gọi `prisma.$transaction(async (tx) => ...)`, dựng repository gắn với `tx` rồi truyền vào `work`. Mọi query trong transaction phải đi qua `tx`; giữ transaction ngắn, không gọi network (push, HTTP) bên trong.

**Chưa cần:** use case chỉ ghi một aggregate → gọi repository trực tiếp.

### Strategy — port có ≥ 2 adapter chọn lúc runtime
**Khi:** có biến thể thật, ví dụ mở rộng lịch lặp (`daily`/`weekly`/`custom`) hoặc kênh thông báo (web-push + FCM song song).
Interface strategy nằm ở `domain` (nếu là rule thuần) hoặc `application/ports` (nếu chạm IO).

**Chưa cần:** chỉ có một biến thể → viết hàm/method thẳng, tách sau khi biến thể thứ hai xuất hiện.

### Domain Event
**Khi:** một hành động cần kích hoạt phản ứng ở feature khác (Task được lên lịch → đặt reminder push) mà không muốn use case gọi chéo nhiều port.
Trước khi đưa vào, ghi ADR (skill `domain-modeling`) chốt cơ chế dispatch.

## Dấu hiệu cần refactor

| Dấu hiệu | Hướng xử lý |
| --- | --- |
| Controller có `if` nghiệp vụ hoặc gọi > 1 use case | Gộp thành một use case |
| Use case > ~80 dòng hoặc nhiều nhánh rule | Đẩy rule vào entity/value object |
| `BaseRepository<T>` generic với nhiều method không ai dùng | Thay bằng repository riêng, method theo nhu cầu |
| Prisma type xuất hiện ngoài `infrastructure/persistence` | Thêm/sửa mapper |
| Port chỉ có một adapter và không phải ranh giới IO | Xoá port, dùng class cụ thể |
| Service "manager/helper/util" ôm nhiều feature | Tách theo feature, chuyển rule vào domain |

Quy trình refactor an toàn: [`refactoring.md`](refactoring.md).
