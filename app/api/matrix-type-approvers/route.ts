import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { matrixTypeApproverSchema } from "@/lib/validation/matrixTypeApprover";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canManageReferenceData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = matrixTypeApproverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const created = await prisma.matrixTypeApprover.create({
      data: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target : [];
      if (fields.includes("approverId")) {
        return NextResponse.json(
          {
            error:
              "This approver is already assigned to a different Level for this Matrix Type / Department / Business Unit / Location combination.",
          },
          { status: 409 }
        );
      }
      if (fields.includes("level")) {
        return NextResponse.json(
          {
            error:
              "An approver is already assigned to this Level for this Matrix Type / Department / Business Unit / Location combination.",
          },
          { status: 409 }
        );
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    throw err;
  }
}
