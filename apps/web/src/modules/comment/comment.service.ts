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

import * as workspaceRepo from "../workspace/workspace.repo";

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

    const allMembers = await workspaceRepo.listMembers(ctx.workspaceId, tx);
    const authorMember = allMembers.find(m => m.id === ctx.workspaceMemberId);
    const authorName = authorMember ? authorMember.fullName : "A workspace member";

    // 1. Process Mentions
    const mentionMatches = data.body.match(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g) || [];
    const mentionedNamesOrEmails = mentionMatches.map(m => m.slice(1).toLowerCase());
    const notifiedMemberIds = new Set<string>();

    if (mentionedNamesOrEmails.length > 0) {
      const mentionNotifications = [];
      for (const member of allMembers) {
        if (member.id === ctx.workspaceMemberId) continue;
        const matchesName = mentionedNamesOrEmails.includes(member.fullName.toLowerCase()) || 
                            mentionedNamesOrEmails.includes(member.email.toLowerCase()) ||
                            mentionedNamesOrEmails.includes(member.email.split("@")[0]?.toLowerCase() || "");
        
        if (matchesName && !notifiedMemberIds.has(member.id)) {
          notifiedMemberIds.add(member.id);
          mentionNotifications.push({
            workspaceId: ctx.workspaceId,
            recipientMemberId: member.id,
            projectId: p.projectId,
            type: "comment.mention",
            title: `${authorName} mentioned you in a comment`,
            body: data.body.slice(0, 140),
            entityType: "task",
            entityId: p.taskId,
          });
        }
      }

      if (mentionNotifications.length > 0) {
        await enqueueNotifications(tx, mentionNotifications);
      }
    }

    // 2. Process Assignee Notification (if not already notified via mention)
    if (task.assigneeMemberId && task.assigneeMemberId !== ctx.workspaceMemberId && !notifiedMemberIds.has(task.assigneeMemberId)) {
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
