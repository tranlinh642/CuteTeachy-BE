import { Gender } from '../../domain/account/profile.entity';
import { UnauthorizedError } from '../../domain/account/account.errors';
import { AccountRepository } from './ports/account.repository.port';
import { Clock } from '../shared/ports/clock.port';
import { toUserDto, UserDto } from './account.dto';

export interface UpdateProfileInput {
  accountId: string;
  fullName?: string;
  displayName?: string;
  title?: string | null;
  gender?: Gender;
}

export class UpdateProfileUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProfileInput): Promise<UserDto> {
    const account = await this.accountRepo.findById(input.accountId);
    if (!account) {
      throw new UnauthorizedError('Account not found');
    }

    account.profile.update(
      {
        fullName: input.fullName,
        displayName: input.displayName,
        title: input.title,
        gender: input.gender,
      },
      this.clock.now(),
    );

    await this.accountRepo.updateProfile(account.profile);

    return toUserDto(account);
  }
}
