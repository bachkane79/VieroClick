import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listMyNotifications } from "@/modules/notification/notification.service";
import { toNotificationView } from "@/modules/notification/notification.view";
import { InboxClient } from "@/modules/notification/components/inbox-client";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function InboxPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const notifications = await listMyNotifications(workspace.id);

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mentions, assignments, and AI signals across {workspace.name}
        </p>
      </div>
      <InboxClient
        workspaceId={workspace.id}
        workspaceSlug={slug}
        notifications={notifications.map(toNotificationView)}
      />
    </div>
  );
}
