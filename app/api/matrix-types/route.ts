import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { matrixTypeSchema } from "@/lib/validation/matrixType";

const MAX_CODE_ATTEMPTS = 5;

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
  const parsed = matrixTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const count = await prisma.matrixType.count();
    const matrixCode = `MT-${String(count + 1).padStart(3, "0")}`;

    try {
      const created = await prisma.matrixType.create({
        data: { matrixCode, name: parsed.data.name, creatorId: session.sub },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = err.meta?.target;
        const fields = Array.isArray(target) ? target : [];
        if (fields.includes("name")) {
          return NextResponse.json(
            { error: "A matrix type with this name already exists" },
            { status: 409 }
          );
        }
        if (fields.includes("matrixCode")) {
          continue;
        }
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique matrix code, please retry" },
    { status: 409 }
  );
}
