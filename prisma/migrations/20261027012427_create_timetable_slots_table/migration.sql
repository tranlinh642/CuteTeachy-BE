-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('pink', 'blue', 'beige', 'lavender', 'rose', 'mint');

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT,
    "room" TEXT,
    "tone" "Tone" NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_slots_accountId_idx" ON "timetable_slots"("accountId");

-- CreateIndex
CREATE INDEX "timetable_slots_accountId_deletedAt_idx" ON "timetable_slots"("accountId", "deletedAt");

-- CreateIndex
CREATE INDEX "timetable_slots_accountId_updatedAt_idx" ON "timetable_slots"("accountId", "updatedAt");

-- CreateIndex
CREATE INDEX "timetable_slots_deletedAt_idx" ON "timetable_slots"("deletedAt");

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
