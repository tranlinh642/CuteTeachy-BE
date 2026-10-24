# Testing

Test chạy qua **interface** của module (seam), không test chi tiết bên trong. Chu trình viết code mới: skill `tdd` (red → green → refactor, một lát cắt mỗi vòng).

## Ba tầng test

| Tầng | Đối tượng | Dependency | Cần Nest/DB? |
| --- | --- | --- | --- |
| Domain unit | Entity, Value Object | Không | Không |
| Use case unit | `XxxUseCase.execute` | Fake port (in-memory) | Không |
| Integration / e2e | Repository Prisma, controller → DB | DB test thật | Có |

Phần lớn test nằm ở hai tầng đầu vì domain/application framework-free.

## Fake port thay vì mock từng method

Viết một adapter in-memory cho mỗi port, đặt ở `test/fakes/` và tái sử dụng:

```ts
export class InMemoryTaskRepository implements TaskRepository {
  private readonly rows = new Map<string, Task>();
  async findById(id: string, userId: string) {
    const t = this.rows.get(id);
    return t && t.userId === userId ? t : null;
  }
  async save(task: Task) { this.rows.set(task.id, task); }
  // ...
}

export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}
  now() { return this.at; }
}
```

Use case test dựng trực tiếp, không qua container:

```ts
const useCase = new CreateTaskUseCase(new InMemoryTaskRepository(), new FixedClock(at), new SequentialIds());
```

Fake in-memory chính là adapter thứ hai khiến port trở thành seam thật.

## Assert hành vi, không assert cách gọi

- Kiểm tra trạng thái quan sát được (task đã lưu, output trả về, error `code`), thay vì đếm số lần gọi method.
- Mock (spy) chỉ dùng cho port có side effect ra ngoài không đọc lại được (ví dụ `PushNotifier.send`).

## Integration / e2e

- Repository Prisma test với DB test riêng (biến môi trường riêng, không trỏ DB production).
- E2E dùng `Test.createTestingModule({ imports: [AppModule] })`, thay adapter ra ngoài process bằng `.overrideProvider(TOKEN).useValue(fake)` rồi `.compile()`.
- Guard auth trong e2e: override `TOKEN_SERVICE` bằng fake trả `userId` cố định.

## Quy ước

- File test cạnh file nguồn: `create-task.use-case.spec.ts`; e2e ở `test/e2e/`.
- Tên test mô tả hành vi bằng ngôn ngữ domain: `"đổi gender sang male thì themePreference về auto"`.
- Bug fix luôn kèm một test đỏ trước khi sửa (skill `diagnosing-bugs`).
