"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./report.service";

interface BaseArgs {
  workspaceId: string;
  projectId: string;
  slug: string;
}

export async function createReportAction(args: BaseArgs & { data: unknown }) {
  return runAction(async () => {
    const report = await service.createReport({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      input: args.data,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return report;
  });
}

export async function approveReportAction(args: BaseArgs & { reportId: string }) {
  return runAction(async () => {
    const report = await service.approveReport({
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      reportId: args.reportId,
    });
    revalidatePath(`/workspace/${args.slug}/project/${args.projectId}`);
    return report;
  });
}
