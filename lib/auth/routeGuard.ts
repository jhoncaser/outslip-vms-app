import type { SessionPayload } from "./session";

const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/change-password";
const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
const LOGIN_PATH = "/login";

export function resolveRedirect(input: {
  pathname: string;
  session: SessionPayload | null;
}): string | null {
  const { pathname, session } = input;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!session) {
    return isPublicPath ? null : LOGIN_PATH;
  }

  if (isPublicPath) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (session.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return CHANGE_PASSWORD_PATH;
  }

  return null;
}
