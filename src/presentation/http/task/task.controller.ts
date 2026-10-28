import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateTaskUseCase } from '../../../application/task/create-task.use-case';
import { UpdateTaskUseCase } from '../../../application/task/update-task.use-case';
import { DeleteTaskUseCase } from '../../../application/task/delete-task.use-case';
import { ListTasksUseCase } from '../../../application/task/list-tasks.use-case';
import { TaskDto } from '../../../application/task/task.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskRequestDto, ListTasksQueryDto, UpdateTaskRequestDto } from './task.dto';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
    private readonly listTasksUseCase: ListTasksUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateTaskRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TaskDto> {
    const result = await this.createTaskUseCase.execute({
      id: dto.id,
      accountId: user.sub,
      title: dto.title,
      notes: dto.notes,
      date: dto.date,
      time: dto.time,
      category: dto.category,
      priority: dto.priority,
      completed: dto.completed,
      tagIds: dto.tagIds,
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.task;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTasksQueryDto,
  ): Promise<SyncEnvelope<TaskDto>> {
    return this.listTasksUseCase.execute({
      accountId: user.sub,
      from: query.from,
      to: query.to,
      updatedSince: query.updatedSince,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTaskRequestDto,
  ): Promise<TaskDto> {
    return this.updateTaskUseCase.execute({
      id,
      accountId: user.sub,
      title: dto.title,
      notes: dto.notes,
      date: dto.date,
      time: dto.time,
      category: dto.category,
      priority: dto.priority,
      completed: dto.completed,
      tagIds: dto.tagIds,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    await this.deleteTaskUseCase.execute({
      id,
      accountId: user.sub,
    });
  }
}
