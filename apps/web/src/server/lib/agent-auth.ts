/**
 * Agent Service Authentication
 *
 * Validates requests from the agent-api service using a static Bearer token.
 * Token must match the AGENT_API_SECRET environment variable.
 *
 * Usage:
 *   if (!isAgentRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export function isAgentRequest(request: Request): boolean {
  const serviceKey = process.env.AGENT_API_SECRET;
  if (!serviceKey) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  return token === serviceKey;
}
