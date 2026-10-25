export type Gender = 'female' | 'male' | 'other';

export interface UpdateProfileProps {
  fullName?: string;
  displayName?: string;
  title?: string | null;
  gender?: Gender | null;
}

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

  get isOnboardingCompleted(): boolean {
    return this.props.onboardingCompletedAt !== null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(props: UpdateProfileProps, now = new Date()): void {
    if (props.fullName !== undefined) {
      this.props.fullName = props.fullName.trim();
    }
    if (props.displayName !== undefined) {
      this.props.displayName = props.displayName.trim();
    }
    if (props.title !== undefined) {
      if (props.title === null || props.title.trim() === '') {
        this.props.title = undefined;
      } else {
        this.props.title = props.title.trim();
      }
    }
    if (props.gender !== undefined) {
      this.props.gender = props.gender;
    }

    const isComplete =
      this.props.fullName.trim() !== '' &&
      this.props.displayName.trim() !== '' &&
      this.props.gender !== null;

    if (isComplete && !this.props.onboardingCompletedAt) {
      this.props.onboardingCompletedAt = now;
    }

    this.props.updatedAt = now;
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
