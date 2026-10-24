# Dependency Injection (NestJS)

Nguyên tắc: **application định nghĩa port, infrastructure cung cấp adapter, composition nối hai bên.** Domain và application không biết DI container tồn tại.

## 1. Port + token (application)

TypeScript interface bị xoá khi compile, nên mỗi port đi kèm một `Symbol` làm DI token, đặt chung file:

```ts
// src/application/task/ports/task.repository.port.ts
import type { Task } from '../../../domain/task/task.entity';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface TaskRepository {
  findById(id: string, userId: string): Promise<Task | null>;
  findByDateRange(userId: string, from: Date, to: Date): Promise<Task[]>;
  save(task: Task): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
```

Port mô tả nhu cầu của use case (ngôn ngữ domain), không mô phỏng API của Prisma.

## 2. Use case nhận dependency qua constructor (application, không decorator)

```ts
// src/application/task/create-task.use-case.ts
export class CreateTaskUseCase {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateTaskInput): Promise<TaskOutput> {
    const task = Task.create({ id: this.ids.next(), ...input, createdAt: this.clock.now() });
    await this.tasks.save(task);
    return toTaskOutput(task);
  }
}
```

## 3. Adapter (infrastructure, được dùng decorator Nest)

```ts
// src/infrastructure/persistence/prisma/repositories/prisma-task.repository.ts
@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}
  // ...dùng TaskMapper để chuyển row ↔ entity
}
```

## 4. Composition Root (composition)

Nơi duy nhất biết adapter nào thoả port nào. Use case đăng ký bằng `useFactory` + `inject`, nên class use case không cần `@Injectable()`:

```ts
// src/composition/task.module.ts
@Module({
  imports: [SharedModule],
  controllers: [TaskController],
  providers: [
    { provide: TASK_REPOSITORY, useClass: PrismaTaskRepository },
    {
      provide: CreateTaskUseCase,
      useFactory: (tasks: TaskRepository, clock: Clock, ids: IdGenerator) =>
        new CreateTaskUseCase(tasks, clock, ids),
      inject: [TASK_REPOSITORY, CLOCK, ID_GENERATOR],
    },
  ],
})
export class TaskModule {}
```

Controller inject use case theo class (class là token hợp lệ):

```ts
@Controller('tasks')
export class TaskController {
  constructor(private readonly createTask: CreateTaskUseCase) {}
}
```

Adapter cần inject port khác dùng `@Inject(TOKEN)` với kiểu là interface.

## Quy ước

- **Một token, một file port.** Tên token = `SCREAMING_SNAKE` của tên port.
- **Scope mặc định singleton.** Context theo request (userId) truyền tường minh qua `input`, không dùng request-scoped provider.
- **Shared ports** (`CLOCK`, `ID_GENERATOR`, `UNIT_OF_WORK`, `PrismaService`) khai báo và `exports` trong `SharedModule`.
- **Config** inject như một provider có kiểu (`APP_CONFIG` token), không đọc `process.env` rải rác.
- **Không gọi `new` adapter** trong use case/controller; mọi kết nối đi qua composition.
- Muốn đổi adapter (ví dụ web-push → FCM) chỉ sửa một dòng trong module của composition.

## Kiểm tra nhanh khi review

- [ ] Port mới có token `Symbol` và nằm trong `application/**/ports/`.
- [ ] Không có `@Injectable`/`@Inject` trong `domain/` hoặc `application/`.
- [ ] Mọi `provide:` của port nằm trong `src/composition/`.
- [ ] Use case mới đã đăng ký `useFactory` với `inject` đủ và đúng thứ tự tham số constructor.
