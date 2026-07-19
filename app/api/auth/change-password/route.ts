import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: session.sub },
    data: { passwordHash, mustChangePassword: false },
  });

  const refreshedToken = await createSessionToken({
    ...session,
    mustChangePassword: false,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, refreshedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
