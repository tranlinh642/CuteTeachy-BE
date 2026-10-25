import { Email } from './email.vo';
import { Profile } from './profile.entity';

export type LoginProviderKind = 'password' | 'google';

export interface AccountProps {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  loginProviders: LoginProviderKind[];
  profile: Profile;
  createdAt: Date;
  updatedAt: Date;
}

export class Account {
  private constructor(private readonly props: AccountProps) {}

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get emailVerifiedAt(): Date | null {
    return this.props.emailVerifiedAt;
  }

  get loginProviders(): LoginProviderKind[] {
    return [...this.props.loginProviders];
  }

  get profile(): Profile {
    return this.props.profile;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasLoginProvider(provider: LoginProviderKind): boolean {
    return this.props.loginProviders.includes(provider);
  }

  linkGoogle(): void {
    if (!this.hasLoginProvider('google')) {
      this.props.loginProviders.push('google');
      this.props.updatedAt = new Date();
    }
  }

  static registerWithPassword(props: {
    id: string;
    email: Email;
    profileId: string;
    now?: Date;
  }): Account {
    const now = props.now ?? new Date();
    const profile = Profile.createEmpty(props.id, props.profileId, now);

    return new Account({
      id: props.id,
      email: props.email.value,
      emailVerifiedAt: null,
      loginProviders: ['password'],
      profile,
      createdAt: now,
      updatedAt: now,
    });
  }

  static registerWithGoogle(props: {
    id: string;
    email: Email;
    profileId: string;
    fullName?: string;
    displayName?: string;
    avatarUrl?: string;
    now?: Date;
  }): Account {
    const now = props.now ?? new Date();
    const profile = Profile.reconstitute({
      id: props.profileId,
      accountId: props.id,
      fullName: props.fullName ?? '',
      displayName: props.displayName ?? '',
      title: undefined,
      gender: null,
      avatarUrl: props.avatarUrl ?? undefined,
      avatarKey: undefined,
      onboardingCompletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return new Account({
      id: props.id,
      email: props.email.value,
      emailVerifiedAt: now,
      loginProviders: ['google'],
      profile,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AccountProps): Account {
    return new Account(props);
  }
}
