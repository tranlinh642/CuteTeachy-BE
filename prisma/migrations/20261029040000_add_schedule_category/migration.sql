-- CreateEnum
CREATE TYPE "ScheduleCategory" AS ENUM ('school_teaching', 'extra_teaching', 'self_study');

-- AlterTable
ALTER TABLE "timetable_slots" ADD COLUMN "category" "ScheduleCategory" NOT NULL DEFAULT 'school_teaching';

-- AlterTable
ALTER TABLE "class_sessions" ADD COLUMN "category" "ScheduleCategory";
