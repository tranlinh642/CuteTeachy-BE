import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ListInAppNotificationsUseCase } from '../../../application/notification/list-in-app-notifications.use-case';
import { MarkInAppNotificationReadUseCase } from '../../../application/notification/mark-in-app-notification-read.use-case';
import { MarkAllInAppNotificationsReadUseCase } from '../../../application/notification/mark-all-in-app-notifications-read.use-case';
import { InAppNotificationDto } from '../../../application/notification/notification.dto';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
  MarkAllNotificationsReadResponseDto,
} from './notification.dto';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly listNotificationsUseCase: ListInAppNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkInAppNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllInAppNotificationsReadUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query?: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    return this.listNotificationsUseCase.execute({
      accountId: user.sub,
      unreadOnly: query?.unreadOnly,
      limit: query?.limit,
    });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<InAppNotificationDto> {
    return this.markNotificationReadUseCase.execute({
      id,
      accountId: user.sub,
    });
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<MarkAllNotificationsReadResponseDto> {
    return this.markAllNotificationsReadUseCase.execute({
      accountId: user.sub,
    });
  }
}
