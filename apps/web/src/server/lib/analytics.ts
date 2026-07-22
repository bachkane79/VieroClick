import "server-only";
import { db, productEvents } from "@vieroc/db";
import { getUserId } from "./context";

/**
 * Fire-and-forget product telemetry (funnel events, roadmap §4.2). Never
 * throws and never blocks the mutation that emitted it — analytics must not
 * be able to fail a user action. Actor is the signed-in user (or null for
 * pre-auth surfaces); agent/service flows must NOT call this (spec §4).
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  void (async () => {
    let userId: string | null = null;
    try {
      userId = await getUserId();
    } catch {
      userId = null;
    }
    try {
      await db.insert(productEvents).values({ userId, event, props });
    } catch (error) {
      console.error(`[analytics] failed to record ${event}:`, error);
    }
  })();
}
