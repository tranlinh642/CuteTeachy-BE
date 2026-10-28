import { Account, LoginProviderKind } from '../../domain/account/account.entity';
import { Gender } from '../../domain/account/profile.entity';

export interface UserDto {
  id: string;
  email: string;
  emailVerified: boolean;
  loginProviders: LoginProviderKind[];
  fullName: string;
  displayName: string;
  title?: string;
  gender: Gender | null;
  avatarUrl?: string;
  onboardingCompletedAt: string | null;
}

export interface AuthSessionDto {
  user: UserDto;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

export function toUserDto(account: Account): UserDto {
  return {
    id: account.id,
    email: account.email,
    emailVerified: account.emailVerifiedAt !== null,
    loginProviders: account.loginProviders,
    fullName: account.profile.fullName,
    displayName: account.profile.displayName,
    title: account.profile.title ?? undefined,
    gender: account.profile.gender,
    avatarUrl: account.profile.avatarUrl ?? undefined,
    onboardingCompletedAt: account.profile.onboardingCompletedAt
      ? account.profile.onboardingCompletedAt.toISOString()
      : null,
  };
}
