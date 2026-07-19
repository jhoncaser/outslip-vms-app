import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

describe("POST /api/auth/logout", () => {
  it("redirects to /login and clears the session cookie", async () => {
    const request = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=some-token` },
    });

    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });
});
