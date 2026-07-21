"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./organization.service";

export async function createOrganizationAction(data: unknown) {
  return runAction(async () => {
    const org = await service.createOrganization(data);
    revalidatePath("/dashboard");
    return org;
  });
}

export async function listMyOrganizationsAction() {
  return runAction(async () => {
    return service.listMyOrganizations();
  });
}

export async function attachWorkspaceToOrgAction(args: {
  workspaceId: string;
  organizationId: string;
  slug: string;
}) {
  return runAction(async () => {
    const res = await service.attachWorkspaceToOrg({
      workspaceId: args.workspaceId,
      organizationId: args.organizationId,
    });
    revalidatePath(`/workspace/${args.slug}`);
    return res;
  });
}
