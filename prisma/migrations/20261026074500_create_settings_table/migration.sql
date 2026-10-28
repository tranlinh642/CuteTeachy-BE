-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_accountId_key" ON "settings"("accountId");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default settings for any existing accounts
INSERT INTO "settings" ("id", "accountId", "locale", "timeZone", "pushEnabled", "reminderLeadMinutes", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    'vi',
    'Asia/Ho_Chi_Minh',
    true,
    15,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "accounts"
WHERE "id" NOT IN (SELECT "accountId" FROM "settings");
