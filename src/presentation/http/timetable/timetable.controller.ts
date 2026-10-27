import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateTimetableSlotUseCase } from '../../../application/timetable/create-timetable-slot.use-case';
import { ListTimetableSlotsUseCase } from '../../../application/timetable/list-timetable-slots.use-case';
import { TimetableSlotDto } from '../../../application/timetable/timetable-slot.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateTimetableSlotRequestDto,
  ListTimetableSlotsQueryDto,
} from './timetable.dto';

@Controller('timetable-slots')
export class TimetableController {
  constructor(
    private readonly createTimetableSlotUseCase: CreateTimetableSlotUseCase,
    private readonly listTimetableSlotsUseCase: ListTimetableSlotsUseCase,
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
}
