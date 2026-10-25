export type Gender = 'female' | 'male' | 'other';

export interface ProfileProps {
  id: string;
  accountId: string;
  fullName: string;
  displayName: string;
  title?: string;
  gender: Gender | null;
  avatarUrl?: string;
  avatarKey?: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Profile {
  private constructor(private readonly props: ProfileProps) {}

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get gender(): Gender | null {
    return this.props.gender;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get avatarKey(): string | undefined {
    return this.props.avatarKey;
  }

  get onboardingCompletedAt(): Date | null {
    return this.props.onboardingCompletedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static createEmpty(accountId: string, id: string, now = new Date()): Profile {
    return new Profile({
      id,
      accountId,
      fullName: '',
      displayName: '',
      gender: null,
      onboardingCompletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ProfileProps): Profile {
    return new Profile(props);
  }
}
