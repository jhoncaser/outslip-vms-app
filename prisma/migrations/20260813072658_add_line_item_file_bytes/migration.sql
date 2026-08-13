/*
  Warnings:

  - You are about to drop the column `uploadFileUrl` on the `TransactionLineItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TransactionLineItem" DROP COLUMN "uploadFileUrl",
ADD COLUMN     "uploadFileData" BYTEA,
ADD COLUMN     "uploadFileType" TEXT;
