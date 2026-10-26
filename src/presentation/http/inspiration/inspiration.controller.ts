import { Controller, Get } from '@nestjs/common';
import { GetTodayInspirationUseCase } from '../../../application/inspiration/get-today-inspiration.use-case';
import type { AccessTokenPayload } from '../../../application/account/ports/token.service.port';
import { CurrentUser } from '../auth/current-user.decorator';
import type { InspirationResponseDto } from './inspiration.dto';

@Controller('inspirations')
export class InspirationController {
  constructor(private readonly getTodayInspirationUseCase: GetTodayInspirationUseCase) {}

  @Get('today')
  async getToday(@CurrentUser() user: AccessTokenPayload): Promise<InspirationResponseDto> {
    const result = await this.getTodayInspirationUseCase.execute({
      accountId: user.sub,
    });

    return {
      id: result.id,
      quote: result.quote,
      quoteVi: result.quoteVi,
      quoteEn: result.quoteEn,
      author: result.author,
    };
  }
}
