import { Injectable } from '@nestjs/common';
import {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../../../application/account/ports/refresh-token.repository.port';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(record: {
    id: string;
    accountId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    createdAt?: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: record.id,
        accountId: record.accountId,
        tokenHash: record.tokenHash,
        familyId: record.familyId,
        expiresAt: record.expiresAt,
        ...(record.createdAt ? { createdAt: record.createdAt } : {}),
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const raw = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      accountId: raw.accountId,
      tokenHash: raw.tokenHash,
      familyId: raw.familyId,
      revokedAt: raw.revokedAt,
      expiresAt: raw.expiresAt,
      createdAt: raw.createdAt,
    };
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt },
    });
  }

  async revokeAllForAccount(accountId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        accountId,
        revokedAt: null,
      },
      data: { revokedAt },
    });
  }
}
