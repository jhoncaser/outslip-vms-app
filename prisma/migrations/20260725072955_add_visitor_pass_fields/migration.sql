-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "personToMeet" TEXT,
ADD COLUMN     "plateNo" TEXT,
ADD COLUMN     "transportType" TEXT,
ADD COLUMN     "visitLocation" TEXT,
ADD COLUMN     "visitorType" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
