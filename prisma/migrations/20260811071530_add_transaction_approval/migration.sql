-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "revisionReason" TEXT;

-- CreateTable
CREATE TABLE "TransactionApproval" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,

    CONSTRAINT "TransactionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionApproval_transactionId_level_key" ON "TransactionApproval"("transactionId", "level");

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
