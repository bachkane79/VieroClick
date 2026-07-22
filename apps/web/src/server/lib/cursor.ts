import "server-only";

// WP-D1 — generic keyset-cursor pagination helper, shared by every paginated
// list (notifications, chat messages, workspace posts, projects, my-tasks,
// activity). A cursor is an opaque, base64-encoded JSON object carrying the
// column values needed to resume a keyset scan (e.g. `{createdAt, id}`, or a
// 3-part tuple like `{pinned, createdAt, id}` for lists sorted on more than
// one column). It is NOT a security boundary — it only encodes an offset into
// a query whose WHERE clause (workspace/project/recipient scoping) is applied
// independently, so a tampered cursor can at worst produce a malformed page,
// never leak out-of-scope rows.

export function encodeCursor(parts: Record<string, string>): string {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url");
}

/** Returns null on missing/malformed input — callers treat that as "start from the beginning". */
export function decodeCursor(raw: string | undefined | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Standard "fetch limit+1" pattern: pass `rows` fetched with `.limit(limit + 1)`.
 * If more rows came back than `limit`, there's a next page — trim to `limit`
 * and encode the cursor from the last kept row; otherwise no next page.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  toCursorParts: (row: T) => Record<string, string>
): Page<T> {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: encodeCursor(toCursorParts(items[items.length - 1]!)) };
  }
  return { items: rows, nextCursor: null };
}
