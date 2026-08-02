import "server-only";
import { completeOnboardingSchema } from "@vieroc/validators";
import { getUserId } from "@/server/lib/context";
import { track } from "@/server/lib/analytics";
import * as workspaceService from "@/modules/workspace/workspace.service";
import * as workspaceRepo from "@/modules/workspace/workspace.repo";
import * as projectService from "@/modules/project/project.service";

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

/**
 * The single onboarding orchestration: create the workspace (with kind) and its
 * first (empty) project, optionally invite teammates, and stamp onboarding as
 * complete. No template seeding — the project starts empty and the user adds
 * work themselves (or asks the AI planner from inside the project).
 *
 * Steps commit sequentially (createWorkspace → createProject) because
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

  // 2. First project — empty, default statuses only.
  const project = await projectService.createProject(workspace.id, {
    name: data.projectName,
  });

  // 3. Team mode: fire off invites (skippable — empty array is fine).
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

  // 4. Mark onboarding complete (analytics/funnel; gate keys off workspace count).
  await workspaceRepo.updateUserDetails(userId, { onboardingCompletedAt: new Date() });
  track("onboarding_completed", {
    mode: data.mode,
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
