import { NextResponse } from "next/server";
import { isAgentRequest } from "@/server/lib/agent-auth";
import { removeLocalFileObject } from "@/server/lib/local-file-storage";
import * as fileRepo from "@/modules/file/file.repo";

/**
 * WP-D6: deletes `files` rows with no `task_attachments` reference, older than
 * a grace period (so a file mid-upload/about-to-be-attached is never caught).
 * No cron scheduler exists yet in apps/web (unlike agent-api's Celery beat) —
 * wire this up via Vercel Cron (`vercel.json` `crons`) once deployed, or call
 * it manually/from agent-api's scheduler in the meantime. Secret-auth like the
 * other Celery-callable entrypoints (see trigger-observer).
 */
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isAgentRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const olderThan = new Date(Date.now() - GRACE_PERIOD_MS);
  const orphans = await fileRepo.listOrphanFiles(olderThan);

  let deleted = 0;
  const errors: string[] = [];
  for (const orphan of orphans) {
    try {
      await removeLocalFileObject(orphan.storageKey);
      await fileRepo.removeFile(orphan.id);
      deleted += 1;
    } catch (err) {
      errors.push(`${orphan.id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({ scanned: orphans.length, deleted, errors });
}
