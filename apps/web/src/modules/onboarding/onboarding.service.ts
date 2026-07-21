import "server-only";
import { and, eq } from "drizzle-orm";
import { db, taskStatuses } from "@vieroc/db";
import { completeOnboardingSchema } from "@vieroc/validators";
import { getUserId } from "@/server/lib/context";
import { track } from "@/server/lib/analytics";
import * as workspaceService from "@/modules/workspace/workspace.service";
import * as workspaceRepo from "@/modules/workspace/workspace.repo";
import * as projectService from "@/modules/project/project.service";
import * as taskService from "@/modules/task/task.service";
import { TEMPLATES } from "./templates";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 4)}`;
    const taken = await workspaceRepo.findBySlug(candidate);
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function dueDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * The single onboarding orchestration: create the workspace (with kind), its
 * first project, seed the chosen template's tasks (or hand off to the AI
 * planner), optionally invite teammates, and stamp onboarding as complete.
 *
 * Steps commit sequentially (createWorkspace → createProject → tasks) because
 * requireActor reads committed membership; each step is individually atomic.
 */
export async function completeOnboarding(input: unknown) {
  const data = completeOnboardingSchema.parse(input);
  const userId = await getUserId();

  // 1. Workspace (kind = mode).
  const slug = await uniqueSlug(slugify(data.workspaceName));
  const workspace = await workspaceService.createWorkspace({
    name: data.workspaceName,
    slug,
    kind: data.mode,
  });

  const isAi = data.template === "ai-generated";

  // 2. First project. AI path enables the planner (dispatched by createProject)
  //    and passes the user's description; template path is manual + seeded.
  const project = await projectService.createProject(workspace.id, {
    name: data.projectName,
    description: isAi ? data.aiPrompt : undefined,
    initialContext: isAi ? data.aiPrompt : undefined,
    aiEnabled: isAi,
  });

  // 3. Seed template tasks (skip for AI — the planner will populate the plan).
  if (!isAi && data.template !== "ai-generated") {
    const def = TEMPLATES[data.template];
    const [todo] = await db
      .select({ id: taskStatuses.id })
      .from(taskStatuses)
      .where(and(eq(taskStatuses.projectId, project.id), eq(taskStatuses.type, "todo")))
      .limit(1);

    if (todo) {
      let position = 0;
      for (const phase of def.seed) {
        for (const task of phase.tasks) {
          await taskService.createTask({
            workspaceId: workspace.id,
            projectId: project.id,
            input: {
              title: task.title,
              statusId: todo.id,
              priority: task.priority ?? "medium",
              dueDate: dueDateStr(task.dueOffset),
              labels: [phase.phase],
              position: position++,
            },
          });
        }
      }
    }
  }

  // 4. Team mode: fire off invites (skippable — empty array is fine).
  if (data.mode === "team") {
    for (const email of data.invites) {
      try {
        await workspaceService.inviteWorkspaceMember(workspace.id, { email, role: "member" });
      } catch (error) {
        // A bad/duplicate email shouldn't abort onboarding.
        console.error("Onboarding invite failed for", email, error);
      }
    }
  }

  // 5. Mark onboarding complete (analytics/funnel; gate keys off workspace count).
  await workspaceRepo.updateUserDetails(userId, { onboardingCompletedAt: new Date() });
  track("onboarding_completed", {
    mode: data.mode,
    template: data.template,
    invites: data.invites.length,
  });

  return { workspaceSlug: workspace.slug, projectId: project.id };
}

/** True if the signed-in user already belongs to at least one workspace. */
export async function hasAnyWorkspace(): Promise<boolean> {
  const userId = await getUserId();
  const list = await workspaceRepo.listForUser(userId);
  return list.length > 0;
}
