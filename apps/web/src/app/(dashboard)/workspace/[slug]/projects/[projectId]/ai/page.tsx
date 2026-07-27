import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { listSuggestions } from "@/modules/agent-suggestion/agent-suggestion.service";
import { listDocs } from "@/modules/project-doc/project-doc.service";
import {
  computeTeamMetrics,
  listProjectMemberProfiles,
} from "@/modules/member-score/member-score.service";
import { requireActor } from "@/server/lib/context";
import { isProjectManager } from "@/server/lib/permissions";
import { AiViewClient } from "./ai-view-client";
import type { MemberCard, PendingSuggestion, AssignmentItem } from "../assign/assign-by-profile";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

/** Read one assignment item from a stored suggestion payload, tolerating both
 * camelCase and the agent's raw snake_case. (Ported from the merged assign tab.) */
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

export default async function ProjectAiPage({ params }: Props) {
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

  const suggestions = await listSuggestions(workspace.id, projectId);

  // Documents surface the `@` file-mention picker in the chat composer; the
  // project_qa agent can read any of these back via its read_document tool.
  const docRows = await listDocs(workspace.id, projectId);
  const docs = docRows.map((d) => ({ id: d.id, title: d.title }));

  // Assignment surface — the former "Giao việc AI" tab, now a manager-only
  // "Phân công" sub-tab inside AI Manager (redesign v2: merged into AI Manager).
  const ctx = await requireActor(workspace.id, projectId);
  const canAssign = isProjectManager(ctx);
  let assignMembers: MemberCard[] = [];
  let assignPending: PendingSuggestion[] = [];
  if (canAssign) {
    const [metrics, profiles] = await Promise.all([
      computeTeamMetrics(projectId),
      listProjectMemberProfiles(projectId),
    ]);
    const profileById = new Map(profiles.map((p) => [p.workspaceMemberId, p]));
    assignMembers = metrics.map((m) => {
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
    assignPending = suggestions
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
  }

  // Adapt suggestions fields
  const adaptedSuggestions = suggestions.map((s) => ({
    ...s,
    reviewedAt: s.reviewedAt ? new Date(s.reviewedAt) : null,
    createdAt: new Date(s.createdAt),
  }));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <AiViewClient
          workspaceId={workspace.id}
          projectId={projectId}
          workspaceSlug={slug}
          initialSuggestions={adaptedSuggestions}
          agentAutonomy={project.agentAutonomy}
          agentConfidenceThreshold={project.agentConfidenceThreshold}
          projectVersion={project.version}
          docs={docs}
          canAssign={canAssign}
          assignMembers={assignMembers}
          assignPending={assignPending}
        />
      </div>
    </div>
  );
}
