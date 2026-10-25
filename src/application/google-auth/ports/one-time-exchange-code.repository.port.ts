export const ONE_TIME_EXCHANGE_CODE_REPOSITORY = Symbol('ONE_TIME_EXCHANGE_CODE_REPOSITORY');

export interface CreateExchangeCodeRecord {
  id: string;
  accountId: string;
  codeHash: string;
  remember: boolean;
  expiresAt: Date;
}

export interface ConsumedExchangeCode {
  id: string;
  accountId: string;
  remember: boolean;
}

export interface OneTimeExchangeCodeRepository {
  create(record: CreateExchangeCodeRecord): Promise<void>;
  consume(codeHash: string, now: Date): Promise<ConsumedExchangeCode | null>;
}
