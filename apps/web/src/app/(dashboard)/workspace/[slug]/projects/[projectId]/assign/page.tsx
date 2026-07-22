import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { computeTeamMetrics, listProjectMemberProfiles } from "@/modules/member-score/member-score.service";
import { listSuggestions } from "@/modules/agent-suggestion/agent-suggestion.service";
import { requireActor } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { NotFoundError } from "@/server/lib/errors";
import { AssignByProfile, type MemberCard, type PendingSuggestion, type AssignmentItem } from "./assign-by-profile";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export const dynamic = "force-dynamic";

/** Read one assignment item from a stored (normalized) suggestion payload,
 * tolerating both camelCase and the agent's raw snake_case just in case. */
function toItem(raw: unknown): AssignmentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const taskId = (r.taskId ?? r.task_id) as string | undefined;
  const memberId = (r.memberId ?? r.member_id) as string | undefined;
  if (!taskId || !memberId) return null;
  const conf = r.confidence;
  return {
    taskId,
    memberId,
    taskTitle: (r.taskTitle ?? r.task_title ?? null) as string | null,
    memberName: (r.memberName ?? r.member_name ?? null) as string | null,
    confidence: typeof conf === "number" ? conf : null,
    reason: (r.reason ?? null) as string | null,
    risk: (r.risk ?? null) as string | null,
  };
}

export default async function ProjectAssignPage({ params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const ctx = await requireActor(workspace.id, projectId);
  const base = `/workspace/${slug}/projects/${projectId}`;
  if (!isProjectManager(ctx)) redirect(`${base}/overview`);

  const [metrics, profiles, suggestions] = await Promise.all([
    computeTeamMetrics(projectId),
    listProjectMemberProfiles(projectId),
    listSuggestions(workspace.id, projectId),
  ]);

  const profileById = new Map(profiles.map((p) => [p.workspaceMemberId, p]));
  const members: MemberCard[] = metrics.map((m) => {
    const p = profileById.get(m.workspaceMemberId);
    return {
      workspaceMemberId: m.workspaceMemberId,
      fullName: m.fullName,
      role: m.role,
      avatarUrl: p?.avatarUrl ?? null,
      skills: p?.skills ?? [],
      seniorityLevel: p?.seniorityLevel ?? 1,
      availabilityHoursPerWeek: p?.availabilityHoursPerWeek ?? null,
      allocationPercent: m.allocationPercent,
      openTasks: m.openTasks,
      committedHours: m.committedHours,
      capacityHours: m.capacityHours,
      overloaded: m.overloaded,
      scores: {
        reliability: m.scores.reliability,
        speed: m.scores.speed,
        quality: m.scores.quality,
      },
    };
  });

  const pending: PendingSuggestion[] = suggestions
    .filter((s) => s.suggestionType === "assignment_suggestion" && s.status === "pending")
    .map((s) => {
      const payload = (s.payload ?? {}) as Record<string, unknown>;
      const rawList = Array.isArray(payload.assignments) ? payload.assignments : [];
      return {
        suggestionId: s.id,
        title: s.title,
        createdAt: new Date(s.createdAt),
        assignments: rawList.map(toItem).filter((x): x is AssignmentItem => x !== null),
      };
    })
    .filter((s) => s.assignments.length > 0);

  return (
    <div className="space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Giao việc theo hồ sơ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Để AI phân bổ task theo kỹ năng và năng lực còn trống của từng người — bạn duyệt trước khi áp dụng.
        </p>
      </header>
      <AssignByProfile
        workspaceId={workspace.id}
        slug={slug}
        projectId={projectId}
        agentAutonomy={project.agentAutonomy}
        agentConfidenceThreshold={project.agentConfidenceThreshold}
        members={members}
        pending={pending}
      />
    </div>
  );
}
