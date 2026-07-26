-- Migration: add_phase4_and_phase5
-- Adds DailyReview (Phase 4), Meeting, and Note (Phase 5) tables
-- Also adds taskNumber column if it doesn't exist yet
-- Safe to run: uses IF NOT EXISTS to avoid errors if already applied

-- Phase 4: DailyReviewType enum
DO $$ BEGIN
    CREATE TYPE "DailyReviewType" AS ENUM ('Morning', 'Evening');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Phase 4: DailyReview table
CREATE TABLE IF NOT EXISTS "DailyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DailyReviewType" NOT NULL,
    "content" JSONB NOT NULL,
    "shownInChat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DailyReview_userId_idx" ON "DailyReview"("userId");
CREATE INDEX IF NOT EXISTS "DailyReview_createdAt_idx" ON "DailyReview"("createdAt");
CREATE INDEX IF NOT EXISTS "DailyReview_userId_type_createdAt_idx" ON "DailyReview"("userId", "type", "createdAt");

-- taskNumber column (Phase 4 added this to Task)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskNumber" SERIAL;

-- Create unique index on taskNumber only if not exists
DO $$ BEGIN
    CREATE UNIQUE INDEX "Task_taskNumber_key" ON "Task"("taskNumber");
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Phase 5: Meeting table
CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transcript" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "participants" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Meeting_meetingDate_idx" ON "Meeting"("meetingDate");
CREATE INDEX IF NOT EXISTS "Meeting_createdAt_idx" ON "Meeting"("createdAt");

-- Phase 5: Note table
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Note_meetingId_idx" ON "Note"("meetingId");
CREATE INDEX IF NOT EXISTS "Note_createdAt_idx" ON "Note"("createdAt");

-- Foreign key: Note -> Meeting
ALTER TABLE "Note" ADD CONSTRAINT "Note_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
