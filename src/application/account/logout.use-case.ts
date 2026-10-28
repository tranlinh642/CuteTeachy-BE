import { Clock } from '../shared/ports/clock.port';
import { RefreshTokenRepository } from './ports/refresh-token.repository.port';
import { TokenService } from './ports/token.service.port';

export interface LogoutInput {
  refreshToken?: string;
}

export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly clock: Clock,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    const tokenHash = this.tokenService.hashRefreshToken(input.refreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (record) {
      await this.refreshTokenRepository.revoke(record.id, this.clock.now());
    }
  }
}
