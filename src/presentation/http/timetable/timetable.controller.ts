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
import { CreateTimetableSlotUseCase } from '../../../application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../../../application/timetable/list-timetable-slots.use-case';
import { UpdateTimetableSlotUseCase } from '../../../application/timetable/update-timetable-slot.use-case';
import { DeleteTimetableSlotUseCase } from '../../../application/timetable/delete-timetable-slot.use-case';
import {
  TimetableSlotDto,
  UpdateTimetableSlotResult,
} from '../../../application/timetable/timetable-slot.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateTimetableSlotRequestDto,
  ListTimetableSlotsQueryDto,
  UpdateTimetableSlotRequestDto,
} from './timetable.dto';

@Controller('timetable-slots')
export class TimetableController {
  constructor(
    private readonly createTimetableSlotUseCase: CreateTimetableSlotUseCase,
    private readonly listTimetableSlotsUseCase: ListTimetableSlotsUseCase,
    private readonly updateTimetableSlotUseCase: UpdateTimetableSlotUseCase,
    private readonly deleteTimetableSlotUseCase: DeleteTimetableSlotUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateTimetableSlotRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TimetableSlotDto> {
    const result = await this.createTimetableSlotUseCase.execute({
      id: dto.id,
      accountId: user.sub,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subject: dto.subject,
      grade: dto.grade,
      room: dto.room,
      tone: dto.tone,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.slot;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTimetableSlotsQueryDto,
  ): Promise<SyncEnvelope<TimetableSlotDto>> {
    return this.listTimetableSlotsUseCase.execute({
      accountId: user.sub,
      updatedSince: query.updatedSince,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTimetableSlotRequestDto,
  ): Promise<UpdateTimetableSlotResult> {
    return this.updateTimetableSlotUseCase.execute({
      id,
      accountId: user.sub,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      subject: dto.subject,
      grade: dto.grade,
      room: dto.room,
      tone: dto.tone,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.deleteTimetableSlotUseCase.execute({
      id,
      accountId: user.sub,
    });
  }
}
