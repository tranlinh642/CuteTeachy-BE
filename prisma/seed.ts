import { PrismaClient } from '@prisma/client';

export interface InspirationSeedData {
  id: string;
  quoteVi: string;
  quoteEn: string;
  author: string | null;
}

export const SEED_INSPIRATIONS: InspirationSeedData[] = [
  {
    id: 'insp-1',
    quoteVi: 'Ảnh hưởng của một người thầy tốt không bao giờ phai nhạt.',
    quoteEn: 'The influence of a good teacher can never be erased.',
    author: null,
  },
  {
    id: 'insp-2',
    quoteVi: 'Dạy học là gieo hạt giống cho ngày mai.',
    quoteEn: 'To teach is to touch a life forever.',
    author: null,
  },
  {
    id: 'insp-3',
    quoteVi: 'Mỗi ngày là một cơ hội mới để truyền cảm hứng.',
    quoteEn: 'Every day is a new chance to inspire.',
    author: null,
  },
];

export async function seedInspirations(prisma: PrismaClient): Promise<void> {
  for (const item of SEED_INSPIRATIONS) {
    await prisma.inspiration.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        quoteVi: item.quoteVi,
        quoteEn: item.quoteEn,
        author: item.author,
      },
      update: {
        quoteVi: item.quoteVi,
        quoteEn: item.quoteEn,
        author: item.author,
      },
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedInspirations(prisma);
    console.log(`Seeded ${SEED_INSPIRATIONS.length} inspirations successfully.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
