import type { ActorContext } from "@/server/lib/context";
import { canRunAgentJobs, requirePermission } from "@/server/lib/permissions";

export function assertCanRunAgentJobs(ctx: ActorContext): void {
  requirePermission(canRunAgentJobs(ctx), "Only project managers can run agent jobs");
}
