import {
  Account as PrismaAccount,
  LoginProvider as PrismaLoginProvider,
  Profile as PrismaProfile,
} from '@prisma/client';
import { Account, LoginProviderKind } from '../../../../domain/account/account.entity';
import { Profile } from '../../../../domain/account/profile.entity';

export type PrismaAccountAggregate = PrismaAccount & {
  loginProviders: PrismaLoginProvider[];
  profile: PrismaProfile | null;
};

export class AccountMapper {
  static toDomain(raw: PrismaAccountAggregate): Account {
    const profileProps = raw.profile
      ? {
          id: raw.profile.id,
          accountId: raw.profile.accountId,
          fullName: raw.profile.fullName,
          displayName: raw.profile.displayName,
          title: raw.profile.title ?? undefined,
          gender: raw.profile.gender,
          avatarUrl: raw.profile.avatarUrl ?? undefined,
          avatarKey: raw.profile.avatarKey ?? undefined,
          onboardingCompletedAt: raw.profile.onboardingCompletedAt,
          createdAt: raw.profile.createdAt,
          updatedAt: raw.profile.updatedAt,
        }
      : {
          id: raw.id,
          accountId: raw.id,
          fullName: '',
          displayName: '',
          title: undefined,
          gender: null,
          avatarUrl: undefined,
          avatarKey: undefined,
          onboardingCompletedAt: null,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
        };

    const profile = Profile.reconstitute(profileProps);
    const loginProviders = raw.loginProviders.map(
      (p) => p.provider as LoginProviderKind,
    );

    return Account.reconstitute({
      id: raw.id,
      email: raw.email,
      emailVerifiedAt: raw.emailVerifiedAt,
      loginProviders,
      profile,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
