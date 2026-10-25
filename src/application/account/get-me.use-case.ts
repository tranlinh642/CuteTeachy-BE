import { UnauthorizedError } from '../../domain/account/account.errors';
import { AccountRepository } from './ports/account.repository.port';
import { toUserDto, UserDto } from './account.dto';

export interface GetMeInput {
  accountId: string;
}

export class GetMeUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: GetMeInput): Promise<UserDto> {
    const account = await this.accountRepository.findById(input.accountId);
    if (!account) {
      throw new UnauthorizedError('Account not found');
    }
    return toUserDto(account);
  }
}
