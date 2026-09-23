// Runs before every /app request: makes sure the visitor has a session cookie,
// so the server knows which workspace is theirs. It only sets the cookie; the
// workspace itself is looked up (or created) by src/lib/server/workspaces.ts.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, isValidSessionId, newSessionId } from "@/lib/server/session";

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSessionId(existing)) return NextResponse.next();

  const sessionId = newSessionId();
  // Also add it to this request, so the page being rendered right now sees it.
  request.cookies.set(SESSION_COOKIE, sessionId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true, // page scripts can't read it, so an injected script can't steal it
    secure: process.env.NODE_ENV === "production", // HTTPS only (localhost is plain HTTP)
    sameSite: "lax", // other sites can't make requests with it
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
