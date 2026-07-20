-- CreateTable
CREATE TABLE "MatrixType" (
    "id" TEXT NOT NULL,
    "matrixCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "MatrixType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrixType_matrixCode_key" ON "MatrixType"("matrixCode");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixType_name_key" ON "MatrixType"("name");

-- AddForeignKey
ALTER TABLE "MatrixType" ADD CONSTRAINT "MatrixType_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
