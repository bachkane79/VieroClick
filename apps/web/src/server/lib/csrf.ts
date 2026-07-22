import { NextResponse } from "next/server";

// WP-C5 — CSRF defense for cookie-authenticated REST routes. Server Actions are
// already covered by next.config `serverActions.allowedOrigins`; the plain REST
// routes under /api are not, so a cross-site form/fetch carrying the session
// cookie could act on the user's behalf. We reject a browser request whose Origin
// is not on the allowlist. Requests with no Origin (server-to-server, curl, agent
// bearer calls) are allowed here — those paths authenticate by bearer secret, not
// by the ambient session cookie, so they are not CSRF-exposed.

const DEFAULT_ALLOWED = [
  "click.vieroc.com",
  "localhost:1988",
  "localhost:3000",
  "localhost:3001",
];

/** Host[:port] values allowed as request Origins. Extendable via CSRF_ALLOWED_ORIGINS. */
function allowedHosts(): Set<string> {
  const extra = (process.env.CSRF_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED, ...extra]);
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // no ambient-cookie CSRF surface (server/bearer caller)
  try {
    return allowedHosts().has(new URL(origin).host);
  } catch {
    return false;
  }
}

/** Returns a 403 NextResponse when the Origin is cross-site, else null. */
export function enforceSameOrigin(request: Request): NextResponse | null {
  if (isAllowedOrigin(request)) return null;
  return NextResponse.json(
    { error: "Cross-origin request rejected", code: "forbidden" },
    { status: 403 }
  );
}
