import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { themeSchema } from "@/lib/validation/theme";

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = themeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid theme value" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.sub },
    data: { themePreference: parsed.data.theme },
    select: { themePreference: true },
  });

  return NextResponse.json({ themePreference: updated.themePreference });
}
