import "server-only";

import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import * as taskRepo from "../task/task.repo";
import * as workspaceRepo from "../workspace/workspace.repo";
import { createCommentSchema } from "./comment.schema";
import { assertCanComment, assertCanModifyComment } from "./comment.policy";
import * as events from "./comment.events";
import * as repo from "./comment.repo";

type CommentLink = {
  type: "task" | "doc" | "comment";
  id: string;
  label?: string;
};

async function getTaskInProject(taskId: string, projectId: string) {
  const task = await taskRepo.findById(taskId);
  if (!task || task.projectId !== projectId) throw new NotFoundError("Task");
  return task;
}

async function assertLinksBelongToProject(links: CommentLink[], projectId: string) {
  for (const link of links) {
    if (link.type === "task") {
      const task = await taskRepo.findById(link.id);
      if (!task || task.projectId !== projectId) {
        throw new ValidationError("Linked task must belong to this project");
      }
    }

    if (link.type === "comment") {
      const comment = await repo.findByIdInProject(link.id, projectId);
      if (!comment) throw new ValidationError("Linked comment must belong to this project");
    }

    if (link.type === "doc") {
      const exists = await repo.linkedDocExists(link.id, projectId);
      if (!exists) throw new ValidationError("Linked doc must belong to this project");
    }
  }
}

function mentionTokens(body: string) {
  const matches = body.matchAll(
    /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._-]+)/g
  );
  return [...matches].map((match) => match[1]!.toLowerCase());
}

export async function listComments(workspaceId: string, projectId: string, taskId: string) {
  await requireActor(workspaceId, projectId);
  await getTaskInProject(taskId, projectId);
  return repo.listByTask(taskId);
}

export async function listProjectComments(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  return repo.listByProject(projectId);
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

  const task = await getTaskInProject(p.taskId, p.projectId);
  await assertLinksBelongToProject(data.metadata.links, p.projectId);

  // Threaded reply: parent must be a comment on the same task.
  if (data.parentCommentId) {
    const parent = await repo.findByIdInProject(data.parentCommentId, p.projectId);
    if (!parent || parent.taskId !== p.taskId) {
      throw new ValidationError("Reply target must be a comment on this task");
    }
  }

  return db.transaction(async (tx) => {
    const comment = await repo.create(
      {
        taskId: p.taskId,
        parentCommentId: data.parentCommentId ?? null,
        authorMemberId: ctx.workspaceMemberId,
        body: data.body.trim(),
        metadata: {
          ...data.metadata,
          links: data.metadata.links,
        },
      },
      tx
    );

    await events.commentAdded(tx, ctx, p.taskId, comment.id);

    const allMembers = await workspaceRepo.listMembers(ctx.workspaceId, tx);
    const authorMember = allMembers.find((member) => member.id === ctx.workspaceMemberId);
    const authorName = authorMember ? authorMember.fullName : "A workspace member";
    const mentionedNamesOrEmails = mentionTokens(data.body);
    const notifiedMemberIds = new Set<string>();

    if (mentionedNamesOrEmails.length > 0) {
      const mentionNotifications = [];
      for (const member of allMembers) {
        if (member.id === ctx.workspaceMemberId) continue;

        const fullNameKey = member.fullName.toLowerCase().replace(/\s+/g, ".");
        const emailKey = member.email.toLowerCase();
        const localEmailKey = member.email.split("@")[0]?.toLowerCase() ?? "";
        const matchesName =
          mentionedNamesOrEmails.includes(fullNameKey) ||
          mentionedNamesOrEmails.includes(emailKey) ||
          mentionedNamesOrEmails.includes(localEmailKey);

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

      await enqueueNotifications(tx, mentionNotifications);
    }

    if (
      task.assigneeMemberId &&
      task.assigneeMemberId !== ctx.workspaceMemberId &&
      !notifiedMemberIds.has(task.assigneeMemberId)
    ) {
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
  const existing = await repo.findByIdInProject(p.commentId, p.projectId);
  if (!existing) throw new NotFoundError("Comment");
  assertCanModifyComment(ctx, existing.authorMemberId);

  return db.transaction(async (tx) => {
    await repo.remove(p.commentId, tx);
    return { id: p.commentId };
  });
}
