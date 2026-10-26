-- CreateEnum
CREATE TYPE "TagTone" AS ENUM ('pink', 'blue', 'beige', 'lavender', 'rose', 'mint');

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tone" "TagTone" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tags_accountId_idx" ON "tags"("accountId");

-- CreateIndex
CREATE INDEX "tags_accountId_deletedAt_idx" ON "tags"("accountId", "deletedAt");

-- CreateIndex
CREATE INDEX "tags_accountId_updatedAt_idx" ON "tags"("accountId", "updatedAt");

-- CreateIndex
CREATE INDEX "tags_deletedAt_idx" ON "tags"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tags_accountId_lower_name_key" ON "tags"("accountId", lower("name")) WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
