-- CreateTable
CREATE TABLE "sent_reminders" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "sent_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_reminders_accountId_idx" ON "sent_reminders"("accountId");

-- CreateIndex
CREATE INDEX "sent_reminders_sentAt_idx" ON "sent_reminders"("sentAt");

-- CreateIndex
CREATE INDEX "sent_reminders_remindAt_idx" ON "sent_reminders"("remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "sent_reminders_type_targetId_remindAt_key" ON "sent_reminders"("type", "targetId", "remindAt");

-- AddForeignKey
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
