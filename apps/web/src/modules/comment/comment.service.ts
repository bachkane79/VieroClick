import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import * as taskRepo from "../task/task.repo";
import { createCommentSchema } from "./comment.schema";
import { assertCanComment, assertCanModifyComment } from "./comment.policy";
import * as repo from "./comment.repo";
import * as events from "./comment.events";

export async function listComments(workspaceId: string, projectId: string, taskId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByTask(taskId);
}

export async function addComment(p: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  input: unknown;
}) {
  const data = createCommentSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanComment(ctx);

  const task = await taskRepo.findById(p.taskId);
  if (!task) throw new NotFoundError("Task");

  return db.transaction(async (tx) => {
    const comment = await repo.create(
      {
        taskId: p.taskId,
        authorMemberId: ctx.workspaceMemberId,
        body: data.body,
        metadata: data.metadata,
      },
      tx
    );

    await events.commentAdded(tx, ctx, p.taskId, comment.id);

    if (task.assigneeMemberId && task.assigneeMemberId !== ctx.workspaceMemberId) {
      await enqueueNotifications(tx, [
        {
          workspaceId: ctx.workspaceId,
          recipientMemberId: task.assigneeMemberId,
          projectId: p.projectId,
          type: "task.comment",
          title: `New comment on ${task.title}`,
          body: data.body.slice(0, 140),
          entityType: "task",
          entityId: p.taskId,
        },
      ]);
    }

    return comment;
  });
}

export async function deleteComment(p: {
  workspaceId: string;
  projectId: string;
  commentId: string;
}) {
  const ctx = await requireActor(p.workspaceId, p.projectId);
  const existing = await repo.findById(p.commentId);
  if (!existing) throw new NotFoundError("Comment");
  assertCanModifyComment(ctx, existing.authorMemberId);

  return db.transaction(async (tx) => {
    await repo.remove(p.commentId, tx);
    return { id: p.commentId };
  });
}
