import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { PrismaTagRepository } from '../../persistence/prisma/repositories/prisma-tag.repository';
import { SystemClock } from '../system-clock';
import { PurgeSoftDeletedTagsUseCase } from '../../../application/tag/purge-soft-deleted-tags.use-case';

export async function runPurgeSoftDeletedTags() {
  const prisma = new PrismaClient();
  try {
    const prismaService = prisma as unknown as PrismaService;
    const tagRepo = new PrismaTagRepository(prismaService);
    const clock = new SystemClock();
    const useCase = new PurgeSoftDeletedTagsUseCase(tagRepo, clock);
    const result = await useCase.execute();
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runPurgeSoftDeletedTags()
    .then((res) => {
      console.log(`Purged ${res.purgedCount} soft-deleted tag(s) older than 30 days.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to purge soft-deleted tags:', err);
      process.exit(1);
    });
}
