import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getBotConfig, listChannels } from "@/modules/telegram/telegram.service";
import { listProjects } from "@/modules/project/project.service";
import { NotFoundError } from "@/server/lib/errors";
import { TelegramSettings } from "../telegram-settings";
import { TelegramChannels } from "../telegram-channels";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceIntegrationsSettingsPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  let botConfig;
  let channels;
  let projects;
  try {
    workspace = await getWorkspace(slug);
    [botConfig, channels, projects] = await Promise.all([
      getBotConfig(workspace.id),
      listChannels(workspace.id),
      listProjects(workspace.id),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("settings.workspace.integrations")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.integrations.pageSubtitle")}
        </p>
      </header>
      <TelegramSettings workspaceId={workspace.id} slug={slug} initialConfig={botConfig} />
      {botConfig.connected && (
        <TelegramChannels
          workspaceId={workspace.id}
          slug={slug}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          initialChannels={channels.map((c) => ({
            id: c.id,
            projectId: c.projectId,
            telegramChatId: c.telegramChatId,
            title: c.title,
            isActive: c.isActive,
          }))}
        />
      )}
    </div>
  );
}
