export interface TicketView {
  id: string;
  projectId: string;
  createdByMemberId: string;
  title: string;
  description: string;
  status: "open" | "approved" | "rejected";
  resolutionNote: string | null;
  decidedByMemberId: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toTicketView(ticket: {
  id: string;
  projectId: string;
  createdByMemberId: string;
  title: string;
  description: string;
  status: "open" | "approved" | "rejected";
  resolutionNote: string | null;
  decidedByMemberId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TicketView {
  return {
    id: ticket.id,
    projectId: ticket.projectId,
    createdByMemberId: ticket.createdByMemberId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    resolutionNote: ticket.resolutionNote,
    decidedByMemberId: ticket.decidedByMemberId,
    decidedAt: ticket.decidedAt ? ticket.decidedAt.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
