import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getBotConfig } from "@/modules/telegram/telegram.service";
import { NotFoundError } from "@/server/lib/errors";
import { TelegramSettings } from "../telegram-settings";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceIntegrationsSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  let botConfig;
  try {
    workspace = await getWorkspace(slug);
    botConfig = await getBotConfig(workspace.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tích hợp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kết nối VierocClick với các công cụ bên ngoài.
        </p>
      </header>
      <TelegramSettings workspaceId={workspace.id} slug={slug} initialConfig={botConfig} />
    </div>
  );
}
