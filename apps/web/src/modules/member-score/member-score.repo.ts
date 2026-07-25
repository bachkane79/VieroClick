import "server-only";
import { db, memberProfiles, projectMemberScores, type Executor } from "@vieroc/db";
import { and, eq } from "drizzle-orm";

export type MemberScores = {
  reliability: number;
  speed: number;
  quality: number;
  communication: number;
  blockerHandling: number;
};

/** Same five metrics, but each may be null (no signal / not seeded). */
export type NullableScores = {
  reliability: number | null;
  speed: number | null;
  quality: number | null;
  communication: number | null;
  blockerHandling: number | null;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Serialize a nullable metric to a numeric(5,2) string, or null. */
function fx(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/** Current stored effective scores (0 when the profile row doesn't exist yet). */
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

/** The leader-seeded baseline (null per metric when not seeded). */
export async function getSeed(workspaceMemberId: string, exec: Executor = db): Promise<NullableScores> {
  const [row] = await exec
    .select({
      reliability: memberProfiles.reliabilitySeed,
      speed: memberProfiles.speedSeed,
      quality: memberProfiles.qualitySeed,
      communication: memberProfiles.communicationSeed,
      blockerHandling: memberProfiles.blockerHandlingSeed,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.workspaceMemberId, workspaceMemberId))
    .limit(1);

  return {
    reliability: nullableNum(row?.reliability),
    speed: nullableNum(row?.speed),
    quality: nullableNum(row?.quality),
    communication: nullableNum(row?.communication),
    blockerHandling: nullableNum(row?.blockerHandling),
  };
}

/** Write the recomputed effective scores, creating the profile row if needed. */
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

export type ProfileFields = {
  seed: NullableScores;
  skills: string[];
  seniorityLevel: number;
  availabilityHoursPerWeek: number | null;
  timezone: string | null;
};

/** Leader edit: write the seed baseline + qualitative profile fields. */
export async function upsertProfileFields(
  workspaceMemberId: string,
  fields: ProfileFields,
  exec: Executor = db
): Promise<void> {
  const values = {
    reliabilitySeed: fx(fields.seed.reliability),
    speedSeed: fx(fields.seed.speed),
    qualitySeed: fx(fields.seed.quality),
    communicationSeed: fx(fields.seed.communication),
    blockerHandlingSeed: fx(fields.seed.blockerHandling),
    skills: fields.skills,
    seniorityLevel: fields.seniorityLevel,
    availabilityHoursPerWeek:
      fields.availabilityHoursPerWeek === null ? null : fields.availabilityHoursPerWeek.toFixed(2),
    timezone: fields.timezone,
    updatedAt: new Date(),
  };
  await exec
    .insert(memberProfiles)
    .values({ workspaceMemberId, ...values })
    .onConflictDoUpdate({ target: memberProfiles.workspaceMemberId, set: values });
}

/** Upsert a member's computed profile for a single project. */
export async function upsertProjectScore(
  projectId: string,
  workspaceMemberId: string,
  scores: NullableScores,
  exec: Executor = db
): Promise<void> {
  const values = {
    reliabilityScore: fx(scores.reliability),
    speedScore: fx(scores.speed),
    qualityScore: fx(scores.quality),
    communicationScore: fx(scores.communication),
    blockerHandlingScore: fx(scores.blockerHandling),
    updatedAt: new Date(),
  };
  await exec
    .insert(projectMemberScores)
    .values({ projectId, workspaceMemberId, ...values })
    .onConflictDoUpdate({
      target: [projectMemberScores.projectId, projectMemberScores.workspaceMemberId],
      set: values,
    });
}

/** All per-project computed profiles for a member (used to build the mean). */
export async function listProjectScoresForMember(
  workspaceMemberId: string,
  exec: Executor = db
): Promise<NullableScores[]> {
  const rows = await exec
    .select({
      reliability: projectMemberScores.reliabilityScore,
      speed: projectMemberScores.speedScore,
      quality: projectMemberScores.qualityScore,
      communication: projectMemberScores.communicationScore,
      blockerHandling: projectMemberScores.blockerHandlingScore,
    })
    .from(projectMemberScores)
    .where(eq(projectMemberScores.workspaceMemberId, workspaceMemberId));

  return rows.map((r) => ({
    reliability: nullableNum(r.reliability),
    speed: nullableNum(r.speed),
    quality: nullableNum(r.quality),
    communication: nullableNum(r.communication),
    blockerHandling: nullableNum(r.blockerHandling),
  }));
}

/** Look up an existing per-project score row (for existence checks). */
export async function getProjectScore(
  projectId: string,
  workspaceMemberId: string,
  exec: Executor = db
): Promise<NullableScores | null> {
  const [row] = await exec
    .select({
      reliability: projectMemberScores.reliabilityScore,
      speed: projectMemberScores.speedScore,
      quality: projectMemberScores.qualityScore,
      communication: projectMemberScores.communicationScore,
      blockerHandling: projectMemberScores.blockerHandlingScore,
    })
    .from(projectMemberScores)
    .where(
      and(
        eq(projectMemberScores.projectId, projectId),
        eq(projectMemberScores.workspaceMemberId, workspaceMemberId)
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    reliability: nullableNum(row.reliability),
    speed: nullableNum(row.speed),
    quality: nullableNum(row.quality),
    communication: nullableNum(row.communication),
    blockerHandling: nullableNum(row.blockerHandling),
  };
}
