import { Module } from '@nestjs/common';
import { VERIFICATION_CODE_REPOSITORY } from '../application/verification/ports/verification-code.repository.port';
import { CODE_GENERATOR } from '../application/verification/ports/code-generator.port';
import { CODE_HASHER } from '../application/google-auth/ports/code-hasher.port';
import { PrismaVerificationCodeRepository } from '../infrastructure/persistence/prisma/repositories/prisma-verification-code.repository';
import { CryptoCodeGenerator } from '../infrastructure/verification/crypto-code-generator';
import { Sha256CodeHasher } from '../infrastructure/google-auth/sha256-code-hasher';

@Module({
  providers: [
    {
      provide: VERIFICATION_CODE_REPOSITORY,
      useClass: PrismaVerificationCodeRepository,
    },
    {
      provide: CODE_GENERATOR,
      useClass: CryptoCodeGenerator,
    },
    {
      provide: CODE_HASHER,
      useClass: Sha256CodeHasher,
    },
  ],
  exports: [VERIFICATION_CODE_REPOSITORY, CODE_GENERATOR, CODE_HASHER],
})
export class VerificationModule {}
