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
import { CreateAdHocClassSessionUseCase } from '../../../application/class-session/create-adhoc-class-session.use-case';
import { UpdateClassSessionUseCase } from '../../../application/class-session/update-class-session.use-case';
import { DeleteClassSessionUseCase } from '../../../application/class-session/delete-class-session.use-case';
import { ListClassSessionsUseCase } from '../../../application/class-session/list-class-sessions.use-case';
import { ClassSessionDto } from '../../../application/class-session/class-session.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateAdHocClassSessionRequestDto,
  ListClassSessionsQueryDto,
  UpdateClassSessionRequestDto,
} from './class-session.dto';

@Controller('class-sessions')
export class ClassSessionController {
  constructor(
    private readonly createAdHocClassSessionUseCase: CreateAdHocClassSessionUseCase,
    private readonly updateClassSessionUseCase: UpdateClassSessionUseCase,
    private readonly deleteClassSessionUseCase: DeleteClassSessionUseCase,
    private readonly listClassSessionsUseCase: ListClassSessionsUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateAdHocClassSessionRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClassSessionDto> {
    const result = await this.createAdHocClassSessionUseCase.execute({
      id: dto.id,
      accountId: user.sub,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subject: dto.subject,
      grade: dto.grade,
      room: dto.room,
      tone: dto.tone,
      topic: dto.topic,
      prepItems: dto.prepItems,
      cancelled: dto.cancelled,
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.session;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListClassSessionsQueryDto,
  ): Promise<SyncEnvelope<ClassSessionDto>> {
    return this.listClassSessionsUseCase.execute({
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
    @Body() dto: UpdateClassSessionRequestDto,
  ): Promise<ClassSessionDto> {
    return this.updateClassSessionUseCase.execute({
      id,
      accountId: user.sub,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subject: dto.subject,
      grade: dto.grade,
      room: dto.room,
      tone: dto.tone,
      topic: dto.topic,
      prepItems: dto.prepItems,
      cancelled: dto.cancelled,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    await this.deleteClassSessionUseCase.execute({
      id,
      accountId: user.sub,
    });
  }
}
