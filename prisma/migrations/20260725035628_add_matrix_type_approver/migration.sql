-- CreateTable
CREATE TABLE "MatrixTypeApprover" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matrixTypeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,

    CONSTRAINT "MatrixTypeApprover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrixTypeApprover_matrixTypeId_level_departmentId_business_key" ON "MatrixTypeApprover"("matrixTypeId", "level", "departmentId", "businessUnitId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrixTypeApprover_matrixTypeId_approverId_departmentId_bus_key" ON "MatrixTypeApprover"("matrixTypeId", "approverId", "departmentId", "businessUnitId", "locationId");

-- AddForeignKey
ALTER TABLE "MatrixTypeApprover" ADD CONSTRAINT "MatrixTypeApprover_matrixTypeId_fkey" FOREIGN KEY ("matrixTypeId") REFERENCES "MatrixType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixTypeApprover" ADD CONSTRAINT "MatrixTypeApprover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixTypeApprover" ADD CONSTRAINT "MatrixTypeApprover_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixTypeApprover" ADD CONSTRAINT "MatrixTypeApprover_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixTypeApprover" ADD CONSTRAINT "MatrixTypeApprover_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
