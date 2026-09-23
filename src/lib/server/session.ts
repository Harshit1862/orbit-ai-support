// Anonymous sessions: every visitor gets a random, unguessable ID in an
// HttpOnly cookie (set by src/proxy.ts). It is the only thing that decides
// whose workspace a request can read or change.
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "orbit_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** 32 random bytes, base64url-encoded (43 characters). */
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isValidSessionId(value: string | undefined): value is string {
  return value !== undefined && SESSION_ID.test(value);
}

/** What the database stores instead of the cookie itself. */
export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

/** The current request's session hash, or null if there's no valid session cookie. */
export async function currentSessionHash(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSessionId(value) ? hashSessionId(value) : null;
}
