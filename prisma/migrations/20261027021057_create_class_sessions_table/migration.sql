-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "timetableSlotId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "subject" TEXT,
    "grade" TEXT,
    "room" TEXT,
    "tone" "Tone",
    "topic" TEXT,
    "prepItems" JSONB NOT NULL DEFAULT '[]',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_sessions_accountId_idx" ON "class_sessions"("accountId");

-- CreateIndex
CREATE INDEX "class_sessions_accountId_date_idx" ON "class_sessions"("accountId", "date");

-- CreateIndex
CREATE INDEX "class_sessions_accountId_deletedAt_idx" ON "class_sessions"("accountId", "deletedAt");

-- CreateIndex
CREATE INDEX "class_sessions_accountId_updatedAt_idx" ON "class_sessions"("accountId", "updatedAt");

-- CreateIndex
CREATE INDEX "class_sessions_deletedAt_idx" ON "class_sessions"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_timetableSlotId_date_key" ON "class_sessions"("timetableSlotId", "date");

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "timetable_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
