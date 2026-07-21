-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "enrouteBusinessUnits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "originBusinessUnit" TEXT,
ADD COLUMN     "plannedDate" DATE,
ADD COLUMN     "plannedTime" TIME,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "returnTime" TIME;
