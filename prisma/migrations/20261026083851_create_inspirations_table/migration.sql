-- CreateTable
CREATE TABLE "inspirations" (
    "id" TEXT NOT NULL,
    "quoteVi" TEXT NOT NULL,
    "quoteEn" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspirations_pkey" PRIMARY KEY ("id")
);
