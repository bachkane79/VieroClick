import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listChatDirectory } from "@/modules/channel/channel.service";
import { NotFoundError, ForbiddenError } from "@/server/lib/errors";
import { MessagesSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Chat hub — lands on the first open channel (seeded as #general). */
export default async function ChatIndexPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations();

  let workspace;
  let directory;
  try {
    workspace = await getWorkspace(slug);
    directory = await listChatDirectory(workspace.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const first = directory.channels[0] ?? directory.dms[0];
  if (first) redirect(`/workspace/${slug}/chat/${first.id}`);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center text-center text-muted-foreground">
      <MessagesSquare className="mb-3 h-10 w-10 opacity-40" />
      <p className="text-sm font-semibold">{t("chat.noChannelsTitle")}</p>
      <p className="mt-1 text-xs">{t("chat.noChannelsSub")}</p>
    </div>
  );
}
