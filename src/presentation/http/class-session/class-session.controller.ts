import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ListClassSessionsUseCase } from '../../../application/class-session/list-class-sessions.use-case';
import { ClassSessionDto } from '../../../application/class-session/class-session.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import { ListClassSessionsQueryDto } from './class-session.dto';

@Controller('class-sessions')
export class ClassSessionController {
  constructor(private readonly listClassSessionsUseCase: ListClassSessionsUseCase) {}

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
}
