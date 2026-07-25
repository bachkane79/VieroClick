"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./member-score.service";

export async function updateMemberProfileAction(args: {
  workspaceId: string;
  slug: string;
  data: unknown;
}) {
  return runAction(async () => {
    const effective = await service.updateMemberProfile(args.workspaceId, args.data);
    revalidatePath(`/workspace/${args.slug}/team`);
    return effective;
  });
}
