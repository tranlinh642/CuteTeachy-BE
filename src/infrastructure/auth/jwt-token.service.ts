import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import {
  AccessTokenPayload,
  GeneratedRefreshToken,
  GeneratedToken,
  TokenService,
} from '../../application/account/ports/token.service.port';
import { UnauthorizedError } from '../../domain/account/account.errors';
import { APP_CONFIG, AppConfig } from '../config/app.config';

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 15 * 60 * 1000; // default 15m
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 3600 * 1000;
    case 'd':
      return value * 86400 * 1000;
    default:
      return value * 1000;
  }
}

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async createAccessToken(payload: AccessTokenPayload): Promise<GeneratedToken> {
    const ttlMs = parseDurationToMs(this.config.JWT_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + ttlMs);

    const token = jwt.sign(payload, this.config.JWT_SECRET, {
      expiresIn: Math.floor(ttlMs / 1000),
    });

    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const decoded = jwt.verify(token, this.config.JWT_SECRET) as AccessTokenPayload;
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedError('Invalid access token payload');
      }
      return { sub: decoded.sub };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  async createRefreshToken(remember = false): Promise<GeneratedRefreshToken> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(rawToken);

    const durationStr = remember
      ? this.config.REFRESH_TOKEN_TTL_REMEMBER
      : this.config.REFRESH_TOKEN_TTL_SESSION;

    const ttlMs = parseDurationToMs(durationStr);
    const expiresAt = new Date(Date.now() + ttlMs);

    return {
      token: rawToken,
      tokenHash,
      expiresAt,
    };
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
