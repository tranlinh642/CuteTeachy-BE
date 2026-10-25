import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../../../application/account/ports/account.repository.port';
import { Account } from '../../../../domain/account/account.entity';
import { Profile } from '../../../../domain/account/profile.entity';
import { PrismaService } from '../prisma.service';
import { AccountMapper } from '../mappers/account.mapper';

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Account | null> {
    const raw = await this.prisma.account.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        loginProviders: true,
        profile: true,
      },
    });

    if (!raw) {
      return null;
    }

    return AccountMapper.toDomain(raw);
  }

  async findById(id: string): Promise<Account | null> {
    const raw = await this.prisma.account.findUnique({
      where: { id },
      include: {
        loginProviders: true,
        profile: true,
      },
    });

    if (!raw) {
      return null;
    }

    return AccountMapper.toDomain(raw);
  }

  async createWithPassword(account: Account, passwordHash: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.account.create({
        data: {
          id: account.id,
          email: account.email,
          emailVerifiedAt: account.emailVerifiedAt,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
      });

      await tx.loginProvider.create({
        data: {
          accountId: account.id,
          provider: 'password',
          passwordHash,
        },
      });

      await tx.profile.create({
        data: {
          id: account.profile.id,
          accountId: account.id,
          fullName: account.profile.fullName,
          displayName: account.profile.displayName,
          title: account.profile.title,
          gender: account.profile.gender,
          avatarUrl: account.profile.avatarUrl,
          avatarKey: account.profile.avatarKey,
          onboardingCompletedAt: account.profile.onboardingCompletedAt,
          createdAt: account.profile.createdAt,
          updatedAt: account.profile.updatedAt,
        },
      });
    });
  }

  async getPasswordHash(accountId: string): Promise<string | null> {
    const provider = await this.prisma.loginProvider.findUnique({
      where: {
        accountId_provider: {
          accountId,
          provider: 'password',
        },
      },
    });

    return provider?.passwordHash ?? null;
  }

  async updateProfile(profile: Profile): Promise<void> {
    await this.prisma.profile.update({
      where: { accountId: profile.accountId },
      data: {
        fullName: profile.fullName,
        displayName: profile.displayName,
        title: profile.title ?? null,
        gender: profile.gender,
        avatarUrl: profile.avatarUrl ?? null,
        avatarKey: profile.avatarKey ?? null,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        updatedAt: profile.updatedAt,
      },
    });
  }
}
