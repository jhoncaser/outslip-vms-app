-- CreateTable
CREATE TABLE "TransactionLineItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "visitorName" TEXT,
    "jobTitle" TEXT,
    "company" TEXT,
    "contactNumber" TEXT,
    "emailAddress" TEXT,
    "uploadFileUrl" TEXT,
    "uploadFileName" TEXT,
    "transportType" TEXT,
    "employeeType" TEXT,
    "employeeId" TEXT,
    "name" TEXT,
    "remarks" TEXT,

    CONSTRAINT "TransactionLineItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TransactionLineItem" ADD CONSTRAINT "TransactionLineItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLineItem" ADD CONSTRAINT "TransactionLineItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
