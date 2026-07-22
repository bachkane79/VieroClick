import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";
import { GeneralSettingsForm } from "./general-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceGeneralSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cấu hình cơ bản của workspace.</p>
      </header>
      <GeneralSettingsForm workspace={workspace} />
    </div>
  );
}
