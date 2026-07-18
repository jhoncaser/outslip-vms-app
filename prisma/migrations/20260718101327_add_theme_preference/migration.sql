-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themePreference" "Theme" NOT NULL DEFAULT 'LIGHT';
