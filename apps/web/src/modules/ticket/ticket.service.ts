import "server-only";

import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { enqueueNotifications } from "@/server/lib/notifications";
import { triggerReplan } from "@/modules/project/project.service";
import * as projectRepo from "../project/project.repo";
import { createTicketSchema, decideTicketSchema } from "./ticket.schema";
import { assertCanCreateTicket, assertCanDecideTicket } from "./ticket.policy";
import * as events from "./ticket.events";
import * as repo from "./ticket.repo";
import { toTicketView } from "./ticket.view";

export async function listTickets(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  const rows = await repo.listByProject(projectId);
  return rows.map(toTicketView);
}

export async function createTicket(p: { workspaceId: string; projectId: string; input: unknown }) {
  const data = createTicketSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanCreateTicket(ctx);

  const project = await projectRepo.findById(p.projectId);
  if (!project || project.workspaceId !== p.workspaceId) throw new NotFoundError("Project");

  return db.transaction(async (tx) => {
    const ticket = await repo.create(
      {
        projectId: p.projectId,
        workspaceId: p.workspaceId,
        createdByMemberId: ctx.workspaceMemberId,
        title: data.title,
        description: data.description,
      },
      tx
    );

    await events.ticketCreated(tx, ctx, ticket.id);

    if (project.leadMemberId && project.leadMemberId !== ctx.workspaceMemberId) {
      await enqueueNotifications(tx, [
        {
          workspaceId: p.workspaceId,
          recipientMemberId: project.leadMemberId,
          projectId: p.projectId,
          type: "ticket.submitted",
          title: `New ticket: ${data.title}`,
          body: data.description.slice(0, 140),
          entityType: "ticket",
          entityId: ticket.id,
        },
      ]);
    }

    return toTicketView(ticket);
  });
}

export async function decideTicket(p: {
  workspaceId: string;
  projectId: string;
  ticketId: string;
  input: unknown;
}) {
  const data = decideTicketSchema.parse(p.input);
  const ctx = await requireActor(p.workspaceId, p.projectId);
  assertCanDecideTicket(ctx);

  const existing = await repo.findByIdInProject(p.ticketId, p.projectId);
  if (!existing) throw new NotFoundError("Ticket");
  if (existing.status !== "open") throw new ValidationError("Ticket has already been decided");

  const ticket = await db.transaction(async (tx) => {
    const updated = await repo.update(
      p.ticketId,
      {
        status: data.status,
        resolutionNote: data.resolutionNote ?? null,
        decidedByMemberId: ctx.workspaceMemberId,
        decidedAt: new Date(),
      },
      tx
    );
    if (!updated) throw new NotFoundError("Ticket");

    if (data.status === "approved") {
      await events.ticketApproved(tx, ctx, p.ticketId);
    } else {
      await events.ticketRejected(tx, ctx, p.ticketId);
    }

    if (existing.createdByMemberId !== ctx.workspaceMemberId) {
      await enqueueNotifications(tx, [
        {
          workspaceId: p.workspaceId,
          recipientMemberId: existing.createdByMemberId,
          projectId: p.projectId,
          type: "ticket.decided",
          title:
            data.status === "approved"
              ? `Your ticket "${existing.title}" was approved`
              : `Your ticket "${existing.title}" was rejected`,
          body: data.resolutionNote?.slice(0, 140) ?? null,
          entityType: "ticket",
          entityId: p.ticketId,
        },
      ]);
    }

    return updated;
  });

  // Replan dispatch is an external call — fired only after the decision commits,
  // same fire-and-forget contract as the observer-suggestion replan path.
  if (data.status === "approved") {
    const reason =
      `${existing.title}\n\n${existing.description}\n\n` +
      `Leader resolution: ${data.resolutionNote}`;
    void triggerReplan(p.workspaceId, p.projectId, reason).catch((err) =>
      console.error("Ticket-approved replan dispatch failed:", err)
    );
  }

  return toTicketView(ticket);
}
