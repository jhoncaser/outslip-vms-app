import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resolveRedirect } from "@/lib/auth/routeGuard";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const session = token ? await verifySessionToken(token) : null;

  const redirectTo = resolveRedirect({
    pathname: request.nextUrl.pathname,
    session,
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
