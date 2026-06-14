import "server-only";
import { db } from "@vieroc/db";
import { requireActor } from "@/server/lib/context";
import { NotFoundError } from "@/server/lib/errors";
import { createProjectSchema, updateProjectSchema } from "./project.schema";
import { assertCanCreateProject, assertCanManageProject } from "./project.policy";
import * as repo from "./project.repo";
import * as events from "./project.events";

export async function listProjects(workspaceId: string) {
  await requireActor(workspaceId);
  return repo.listByWorkspace(workspaceId);
}

export async function getProject(workspaceId: string, projectId: string) {
  await requireActor(workspaceId, projectId);
  const project = await repo.findById(projectId);
  if (!project) throw new NotFoundError("Project");
  return project;
}

export async function createProject(workspaceId: string, input: unknown) {
  const data = createProjectSchema.parse(input);
  const ctx = await requireActor(workspaceId);
  assertCanCreateProject(ctx);

  return db.transaction(async (tx) => {
    const project = await repo.create(
      {
        workspaceId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        leadMemberId: data.leadMemberId ?? ctx.workspaceMemberId,
        startDate: data.startDate ?? null,
        targetEndDate: data.targetEndDate ?? null,
        goals: data.goals,
        constraints: data.constraints,
        expectedDeliverables: data.expectedDeliverables,
        initialContext: data.initialContext ?? null,
        createdBy: ctx.userId,
      },
      tx
    );

    // creator becomes project_lead; seed the default board columns
    await repo.addMember(
      {
        projectId: project.id,
        workspaceMemberId: ctx.workspaceMemberId,
        role: "project_lead",
        allocationPercent: 100,
      },
      tx
    );
    await repo.seedDefaultStatuses(project.id, tx);
    await events.projectCreated(tx, ctx, project);

    return project;
  });
}

export async function updateProject(workspaceId: string, projectId: string, input: unknown) {
  const data = updateProjectSchema.parse(input);
  const ctx = await requireActor(workspaceId, projectId);
  assertCanManageProject(ctx);

  const existing = await repo.findById(projectId);
  if (!existing) throw new NotFoundError("Project");

  const patch: Partial<repo.ProjectInsert> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description ?? null;
  if (data.status !== undefined) patch.status = data.status;
  if (data.leadMemberId !== undefined) patch.leadMemberId = data.leadMemberId ?? null;
  if (data.startDate !== undefined) patch.startDate = data.startDate ?? null;
  if (data.targetEndDate !== undefined) patch.targetEndDate = data.targetEndDate ?? null;
  if (data.goals !== undefined) patch.goals = data.goals;
  if (data.constraints !== undefined) patch.constraints = data.constraints;
  if (data.expectedDeliverables !== undefined) patch.expectedDeliverables = data.expectedDeliverables;
  if (data.initialContext !== undefined) patch.initialContext = data.initialContext ?? null;

  return db.transaction(async (tx) => {
    const updated = await repo.update(projectId, patch, tx);
    if (!updated) throw new NotFoundError("Project");
    await events.projectUpdated(tx, ctx, existing, { ...patch });
    return updated;
  });
}
