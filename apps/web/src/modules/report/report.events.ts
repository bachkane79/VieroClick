import { recordEvent, actorFields } from "@/server/lib/events";
import type { ActorContext } from "@/server/lib/context";
import type { Executor } from "@vieroc/db";

interface ReportLike {
  id: string;
  reportDate: string;
  approvedByMemberId: string | null;
}

export function reportCreated(exec: Executor, ctx: ActorContext, report: ReportLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "leader_report",
    entityId: report.id,
    eventType: "report.created",
    after: { reportDate: report.reportDate },
  });
}

export function reportApproved(exec: Executor, ctx: ActorContext, report: ReportLike) {
  return recordEvent(exec, {
    ...actorFields(ctx),
    entityType: "leader_report",
    entityId: report.id,
    eventType: "report.approved",
    after: { approvedByMemberId: report.approvedByMemberId },
  });
}
