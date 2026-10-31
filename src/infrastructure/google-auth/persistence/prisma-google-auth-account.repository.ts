import { Injectable } from '@nestjs/common';
import {
  GoogleAuthAccountRepository,
  LinkGoogleProviderOptions,
} from '../../../application/google-auth/ports/google-auth-account.repository.port';
import { Account } from '../../../domain/account/account.entity';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { AccountMapper } from '../../persistence/prisma/mappers/account.mapper';

@Injectable()
export class PrismaGoogleAuthAccountRepository implements GoogleAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderSubject(provider: string, subject: string): Promise<Account | null> {
    const providerRow = await this.prisma.loginProvider.findFirst({
      where: {
        provider,
        subject,
      },
      include: {
        account: {
          include: {
            loginProviders: true,
            profile: true,
          },
        },
      },
    });

    if (!providerRow || !providerRow.account) {
      return null;
    }

    return AccountMapper.toDomain(providerRow.account);
  }

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

  async createWithGoogle(account: Account, subject: string): Promise<void> {
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
          provider: 'google',
          subject,
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

  async linkGoogleProvider(
    accountId: string,
    subject: string,
    options?: LinkGoogleProviderOptions,
  ): Promise<void> {
    if (options?.verifyEmailAndClearPasswordAt) {
      const now = options.verifyEmailAndClearPasswordAt;
      await this.prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { id: accountId },
          data: {
            emailVerifiedAt: now,
            updatedAt: now,
          },
        });

        await tx.loginProvider.deleteMany({
          where: {
            accountId,
            provider: 'password',
          },
        });

        await tx.loginProvider.upsert({
          where: {
            accountId_provider: {
              accountId,
              provider: 'google',
            },
          },
          update: {
            subject,
          },
          create: {
            accountId,
            provider: 'google',
            subject,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            accountId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
      });
      return;
    }

    await this.prisma.loginProvider.upsert({
      where: {
        accountId_provider: {
          accountId,
          provider: 'google',
        },
      },
      update: {
        subject,
      },
      create: {
        accountId,
        provider: 'google',
        subject,
      },
    });
  }
}
