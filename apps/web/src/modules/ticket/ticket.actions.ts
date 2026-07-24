"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./ticket.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

function revalidateTickets(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/projects/${projectId}/tickets`);
}

export async function listTicketsAction(args: { workspaceId: string; projectId: string }) {
  return runAction(async () => {
    return service.listTickets(args.workspaceId, args.projectId);
  });
}

export async function createTicketAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const ticket = await service.createTicket({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidateTickets(args.slug, args.projectId);
    return ticket;
  });
}

export async function decideTicketAction(args: BaseArgs & { ticketId: string; data: unknown }) {
  return runAction(async () => {
    const ticket = await service.decideTicket({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      ticketId: args.ticketId,
      input: args.data,
    });
    revalidateTickets(args.slug, args.projectId);
    return ticket;
  });
}
