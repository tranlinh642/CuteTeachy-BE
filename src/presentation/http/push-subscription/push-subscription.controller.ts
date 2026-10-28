import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { GetVapidPublicKeyUseCase } from '../../../application/push-subscription/get-vapid-public-key.use-case';
import { UpsertPushSubscriptionUseCase } from '../../../application/push-subscription/upsert-push-subscription.use-case';
import { DeletePushSubscriptionUseCase } from '../../../application/push-subscription/delete-push-subscription.use-case';
import { PushSubscriptionDto } from '../../../application/push-subscription/push-subscription.dto';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import {
  CreatePushSubscriptionRequestDto,
  DeletePushSubscriptionQueryDto,
  DeletePushSubscriptionRequestDto,
  VapidPublicKeyResponseDto,
} from './push-subscription.dto';

@Controller('push')
export class PushSubscriptionController {
  constructor(
    private readonly getVapidPublicKeyUseCase: GetVapidPublicKeyUseCase,
    private readonly upsertPushSubscriptionUseCase: UpsertPushSubscriptionUseCase,
    private readonly deletePushSubscriptionUseCase: DeletePushSubscriptionUseCase,
  ) {}

  @Public()
  @Get('vapid-public-key')
  async getVapidPublicKey(): Promise<VapidPublicKeyResponseDto> {
    return this.getVapidPublicKeyUseCase.execute();
  }

  @Post('subscriptions')
  async upsertSubscription(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePushSubscriptionRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PushSubscriptionDto> {
    const result = await this.upsertPushSubscriptionUseCase.execute({
      accountId: user.sub,
      endpoint: dto.endpoint,
      keys: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.subscription;
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSubscription(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body?: DeletePushSubscriptionRequestDto,
    @Query() query?: DeletePushSubscriptionQueryDto,
  ): Promise<void> {
    const endpoint = body?.endpoint || query?.endpoint;
    if (!endpoint) {
      return;
    }

    await this.deletePushSubscriptionUseCase.execute({
      accountId: user.sub,
      endpoint,
    });
  }
}
