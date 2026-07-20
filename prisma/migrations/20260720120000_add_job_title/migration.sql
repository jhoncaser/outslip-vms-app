-- Add job title / position; backfill existing rows before enforcing NOT NULL.
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT NOT NULL DEFAULT 'Not Specified';
ALTER TABLE "User" ALTER COLUMN "jobTitle" DROP DEFAULT;
