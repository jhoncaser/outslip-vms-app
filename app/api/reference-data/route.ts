import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { referenceDataSchema } from "@/lib/validation/referenceData";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [departments, businessUnits, locations] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ departments, businessUnits, locations });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canManageReferenceData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = referenceDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { type, name } = parsed.data;
  const model =
    type === "department"
      ? prisma.department
      : type === "businessUnit"
        ? prisma.businessUnit
        : prisma.location;

  const created = await model.create({ data: { name } });

  return NextResponse.json(created, { status: 201 });
}
