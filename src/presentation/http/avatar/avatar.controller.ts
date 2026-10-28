import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadAvatarUseCase } from '../../../application/avatar/upload-avatar.use-case';
import { DeleteAvatarUseCase } from '../../../application/avatar/delete-avatar.use-case';
import { UserDto } from '../../../application/account/account.dto';
import { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountValidationError } from '../../../domain/account/account.errors';

@Controller('auth/profile/avatar')
export class AvatarController {
  constructor(
    private readonly uploadAvatarUseCase: UploadAvatarUseCase,
    private readonly deleteAvatarUseCase: DeleteAvatarUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserDto> {
    if (!file || !file.buffer) {
      throw new AccountValidationError('File is required');
    }

    return this.uploadAvatarUseCase.execute({
      accountId: user.sub,
      file: {
        buffer: file.buffer,
        size: file.size,
      },
    });
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async delete(@CurrentUser() user: AccessTokenPayload): Promise<UserDto> {
    return this.deleteAvatarUseCase.execute({
      accountId: user.sub,
    });
  }
}
