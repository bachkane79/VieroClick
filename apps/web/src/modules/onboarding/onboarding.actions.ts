"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/lib/action";
import * as service from "./onboarding.service";

export async function completeOnboardingAction(data: unknown) {
  return runAction(async () => {
    const result = await service.completeOnboarding(data);
    revalidatePath("/dashboard");
    revalidatePath(`/workspace/${result.workspaceSlug}`);
    return result;
  });
}
