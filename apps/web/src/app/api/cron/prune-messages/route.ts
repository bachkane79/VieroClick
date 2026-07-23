import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import * as repo from "@/modules/channel/channel.repo";

/**
 * WP-E2: deletes channel messages older than the retention window (default
 * 90 days, overridable via `CHAT_MESSAGE_RETENTION_DAYS`). No cron scheduler
 * exists yet in apps/web (same situation as cleanup-orphan-files) — wire this
 * up via Vercel Cron once deployed, or call it from agent-api's Celery Beat
 * in the meantime. Secret-auth like the other Celery-callable entrypoints.
 */
const BATCH_SIZE = 1000;

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = Number(process.env.CHAT_MESSAGE_RETENTION_DAYS ?? 90);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;
  let deletedInBatch = 0;
  do {
    deletedInBatch = await repo.deleteMessagesOlderThan(cutoff, BATCH_SIZE);
    totalDeleted += deletedInBatch;
  } while (deletedInBatch === BATCH_SIZE);

  return NextResponse.json({ retentionDays, cutoff: cutoff.toISOString(), deleted: totalDeleted });
}
