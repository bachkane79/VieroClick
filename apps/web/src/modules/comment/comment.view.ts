export interface CommentLinkView {
  type: "task" | "doc" | "comment";
  id: string;
  label?: string;
}

export interface CommentView {
  id: string;
  taskId: string;
  parentCommentId: string | null;
  authorMemberId: string;
  body: string;
  links: CommentLinkView[];
  createdAt: string;
  updatedAt: string;
}

function normalizeLinks(metadata: Record<string, unknown>): CommentLinkView[] {
  const links = metadata.links;
  if (!Array.isArray(links)) return [];

  const normalized: CommentLinkView[] = [];
  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    const record = link as Record<string, unknown>;
    if (record.type !== "task" && record.type !== "doc" && record.type !== "comment") {
      continue;
    }
    if (typeof record.id !== "string") continue;

    normalized.push({
      type: record.type,
      id: record.id,
      label: typeof record.label === "string" ? record.label : undefined,
    });
  }

  return normalized;
}

export function toCommentView(comment: {
  id: string;
  taskId: string;
  parentCommentId?: string | null;
  authorMemberId: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): CommentView {
  return {
    id: comment.id,
    taskId: comment.taskId,
    parentCommentId: comment.parentCommentId ?? null,
    authorMemberId: comment.authorMemberId,
    body: comment.body,
    links: normalizeLinks(comment.metadata),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
