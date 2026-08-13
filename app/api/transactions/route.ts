import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { transactionSchema } from "@/lib/validation/transaction";
import { TRANSACTION_FIELD_LABELS, findMissingRequiredField } from "@/lib/transactionFieldSets";
import { emitTransactionChanged } from "@/lib/transactionEvents";

const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const matrixType = await prisma.matrixType.findUnique({
    where: { id: parsed.data.matrixTypeId },
    select: { name: true },
  });
  if (!matrixType) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }

  const missingField = findMissingRequiredField(matrixType.name, parsed.data);
  if (missingField) {
    return NextResponse.json(
      {
        error: `${TRANSACTION_FIELD_LABELS[missingField]} is required for this transaction type`,
      },
      { status: 400 }
    );
  }

  const openStatus = await prisma.transactionStatus.findUniqueOrThrow({
    where: { name: "Open" },
  });

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const count = await prisma.transaction.count();
    const transactionCode = `OT-${String(count + 1).padStart(3, "0")}`;

    try {
      const created = await prisma.transaction.create({
        data: {
          transactionCode,
          matrixTypeId: parsed.data.matrixTypeId,
          statusId: openStatus.id,
          creatorId: session.sub,
          plannedDate: parsed.data.plannedDate
            ? new Date(parsed.data.plannedDate)
            : undefined,
          plannedTime: parsed.data.plannedTime
            ? new Date(`1970-01-01T${parsed.data.plannedTime}:00.000Z`)
            : undefined,
          returnTime: parsed.data.returnTime
            ? new Date(`1970-01-01T${parsed.data.returnTime}:00.000Z`)
            : undefined,
          originBusinessUnit: parsed.data.originBusinessUnit,
          enrouteBusinessUnits: parsed.data.enrouteBusinessUnits ?? [],
          reason: parsed.data.reason,
          visitorType: parsed.data.visitorType,
          personToMeet: parsed.data.personToMeet,
          departmentId: parsed.data.departmentId,
          businessUnitId: parsed.data.businessUnitId,
          visitLocation: parsed.data.visitLocation,
          transportType: parsed.data.transportType,
          plateNo: parsed.data.plateNo,
        },
      });
      emitTransactionChanged();
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = err.meta?.target;
        const fields = Array.isArray(target) ? target : [];
        if (fields.includes("transactionCode")) {
          continue;
        }
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid transaction type" },
          { status: 400 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique transaction code, please retry" },
    { status: 409 }
  );
}
