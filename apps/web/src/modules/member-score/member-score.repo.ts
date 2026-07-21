import "server-only";
import { db, memberProfiles, type Executor } from "@vieroc/db";
import { eq } from "drizzle-orm";

export type MemberScores = {
  reliability: number;
  speed: number;
  quality: number;
  communication: number;
  blockerHandling: number;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Current stored scores (0 when the profile row doesn't exist yet). */
export async function getScores(workspaceMemberId: string, exec: Executor = db): Promise<MemberScores> {
  const [row] = await exec
    .select({
      reliability: memberProfiles.reliabilityScore,
      speed: memberProfiles.speedScore,
      quality: memberProfiles.qualityScore,
      communication: memberProfiles.communicationScore,
      blockerHandling: memberProfiles.blockerHandlingScore,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.workspaceMemberId, workspaceMemberId))
    .limit(1);

  return {
    reliability: num(row?.reliability),
    speed: num(row?.speed),
    quality: num(row?.quality),
    communication: num(row?.communication),
    blockerHandling: num(row?.blockerHandling),
  };
}

/** Write the recomputed scores, creating the profile row if needed. */
export async function upsertScores(
  workspaceMemberId: string,
  scores: MemberScores,
  exec: Executor = db
): Promise<void> {
  const now = new Date();
  const values = {
    reliabilityScore: scores.reliability.toFixed(2),
    speedScore: scores.speed.toFixed(2),
    qualityScore: scores.quality.toFixed(2),
    communicationScore: scores.communication.toFixed(2),
    blockerHandlingScore: scores.blockerHandling.toFixed(2),
    updatedByAgentAt: now,
    updatedAt: now,
  };
  await exec
    .insert(memberProfiles)
    .values({ workspaceMemberId, ...values })
    .onConflictDoUpdate({ target: memberProfiles.workspaceMemberId, set: values });
}
