import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import {
  ApplyAiScheduleDraftResult,
  ListAiChatMessagesResult,
  SendAiMessageResult,
} from '../../../application/ai-assistant/ai-assistant.dto';
import { ApplyAiScheduleDraftUseCase } from '../../../application/ai-assistant/apply-ai-schedule-draft.use-case';
import { ClearAiChatHistoryUseCase } from '../../../application/ai-assistant/clear-ai-chat-history.use-case';
import { ListAiChatMessagesUseCase } from '../../../application/ai-assistant/list-ai-chat-messages.use-case';
import { SendAiMessageUseCase } from '../../../application/ai-assistant/send-ai-message.use-case';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ApplyAiScheduleDraftRequestDto,
  ListAiChatMessagesQueryDto,
  SendAiMessageRequestDto,
} from './ai-assistant.dto';

@Controller('ai-assistant')
export class AiAssistantController {
  constructor(
    private readonly sendAiMessageUseCase: SendAiMessageUseCase,
    private readonly applyAiScheduleDraftUseCase: ApplyAiScheduleDraftUseCase,
    private readonly listAiChatMessagesUseCase: ListAiChatMessagesUseCase,
    private readonly clearAiChatHistoryUseCase: ClearAiChatHistoryUseCase,
  ) {}

  @Get('messages')
  @HttpCode(HttpStatus.OK)
  async listMessages(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListAiChatMessagesQueryDto,
  ): Promise<ListAiChatMessagesResult> {
    return this.listAiChatMessagesUseCase.execute({
      accountId: user.sub,
      limit: query.limit,
    });
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  async sendMessage(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: SendAiMessageRequestDto | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SendAiMessageResult> {
    return this.sendAiMessageUseCase.execute({
      accountId: user.sub,
      message: dto?.message,
      image: file
        ? {
            buffer: file.buffer,
            size: file.size,
            mimeType: file.mimetype,
          }
        : undefined,
    });
  }

  @Post('drafts/:messageId/apply')
  @HttpCode(HttpStatus.OK)
  async applyDraft(
    @CurrentUser() user: AccessTokenPayload,
    @Param('messageId') messageId: string,
    @Body() dto: ApplyAiScheduleDraftRequestDto,
  ): Promise<ApplyAiScheduleDraftResult> {
    return this.applyAiScheduleDraftUseCase.execute({
      accountId: user.sub,
      messageId,
      conflictStrategy: dto.conflictStrategy,
      items: dto.items,
    });
  }

  @Delete('messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(@CurrentUser() user: AccessTokenPayload): Promise<void> {
    await this.clearAiChatHistoryUseCase.execute({
      accountId: user.sub,
    });
  }
}
