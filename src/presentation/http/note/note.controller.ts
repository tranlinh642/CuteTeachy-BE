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
import { CreateNoteUseCase } from '../../../application/note/create-note.use-case';
import { UpdateNoteUseCase } from '../../../application/note/update-note.use-case';
import { DeleteNoteUseCase } from '../../../application/note/delete-note.use-case';
import { ListNotesUseCase } from '../../../application/note/list-notes.use-case';
import { NoteDto } from '../../../application/note/note.dto';
import { SyncEnvelope } from '../../../domain/shared/sync-envelope';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreateNoteRequestDto,
  ListNotesQueryDto,
  UpdateNoteRequestDto,
} from './note.dto';

@Controller('notes')
export class NoteController {
  constructor(
    private readonly createNoteUseCase: CreateNoteUseCase,
    private readonly updateNoteUseCase: UpdateNoteUseCase,
    private readonly deleteNoteUseCase: DeleteNoteUseCase,
    private readonly listNotesUseCase: ListNotesUseCase,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateNoteRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<NoteDto> {
    const result = await this.createNoteUseCase.execute({
      id: dto.id,
      accountId: user.sub,
      title: dto.title,
      content: dto.content,
      checklist: dto.checklist,
      imageUrl: dto.imageUrl,
      tagIds: dto.tagIds,
      dueDate: dto.dueDate,
      completed: dto.completed,
    });

    if (result.created) {
      res.status(HttpStatus.CREATED);
    } else {
      res.status(HttpStatus.OK);
    }

    return result.note;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListNotesQueryDto,
  ): Promise<SyncEnvelope<NoteDto>> {
    return this.listNotesUseCase.execute({
      accountId: user.sub,
      limit: query.limit,
      cursor: query.cursor,
      q: query.q,
      tagId: query.tagId,
      updatedSince: query.updatedSince,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateNoteRequestDto,
  ): Promise<NoteDto> {
    return this.updateNoteUseCase.execute({
      id,
      accountId: user.sub,
      title: dto.title,
      content: dto.content,
      checklist: dto.checklist,
      imageUrl: dto.imageUrl,
      tagIds: dto.tagIds,
      dueDate: dto.dueDate,
      completed: dto.completed,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.deleteNoteUseCase.execute({
      id,
      accountId: user.sub,
    });
  }
}
