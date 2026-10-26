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
import { CreateTagUseCase } from '../../../application/tag/create-tag.use-case';
import { UpdateTagUseCase } from '../../../application/tag/update-tag.use-case';
import { DeleteTagUseCase } from '../../../application/tag/delete-tag.use-case';
import { ListTagsUseCase } from '../../../application/tag/list-tags.use-case';
import { TagDto } from '../../../application/tag/tag.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTagRequestDto, ListTagsQueryDto, UpdateTagRequestDto } from './tag.dto';

@Controller('tags')
export class TagController {
  constructor(
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
    private readonly listTagsUseCase: ListTagsUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateTagRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TagDto> {
    const result = await this.createTagUseCase.execute({
      id: dto.id,
      accountId: user.sub,
      name: dto.name,
      tone: dto.tone,
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.tag;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTagsQueryDto,
  ): Promise<SyncEnvelope<TagDto>> {
    return this.listTagsUseCase.execute({
      accountId: user.sub,
      updatedSince: query.updatedSince,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTagRequestDto,
  ): Promise<TagDto> {
    return this.updateTagUseCase.execute({
      id,
      accountId: user.sub,
      name: dto.name,
      tone: dto.tone,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    await this.deleteTagUseCase.execute({
      id,
      accountId: user.sub,
    });
  }
}
