"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./file.service";

function revalidateProject(slug: string, projectId: string) {
  revalidatePath(`/workspace/${slug}/project/${projectId}`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/tasks`);
  revalidatePath(`/workspace/${slug}/projects/${projectId}/board`);
}

function getFormFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File)) throw new Error("Choose a file to upload");
  return value;
}

export async function registerFileAction(args: {
  workspaceId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const file = await service.registerFile({
      workspaceId: args.workspaceId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return file;
  });
}

export async function attachFileAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const attachment = await service.attachToTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidateProject(args.slug, args.projectId);
    return attachment;
  });
}

export async function uploadTaskAttachmentAction(args: {
  workspaceId: string;
  projectId: string;
  slug: string;
  taskId: string;
  data: FormData;
}) {
  return runAction(async () => {
    const result = await service.uploadAndAttachToTask({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      taskId: args.taskId,
      file: getFormFile(args.data),
    });
    revalidateProject(args.slug, args.projectId);
    return result;
  });
}
