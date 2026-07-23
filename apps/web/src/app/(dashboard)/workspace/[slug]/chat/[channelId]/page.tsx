import { notFound } from "next/navigation";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listChatDirectory, getChannel, listMessages } from "@/modules/channel/channel.service";
import { ChatClient } from "@/modules/channel/components/chat-client";
import { NotFoundError, ForbiddenError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string; channelId: string }>;
}

export default async function ChannelPage({ params }: Props) {
  const { slug, channelId } = await params;

  let workspace;
  let directory;
  let channel;
  let messages;
  try {
    workspace = await getWorkspace(slug);
    [directory, channel, messages] = await Promise.all([
      listChatDirectory(workspace.id),
      getChannel({ workspaceId: workspace.id, channelId }),
      listMessages({ workspaceId: workspace.id, channelId }),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    throw err;
  }

  return (
    <ChatClient
      workspaceId={workspace.id}
      slug={slug}
      channel={{
        id: channel.id,
        type: channel.type,
        displayName: channel.displayName,
        topic: channel.topic,
      }}
      channels={directory.channels.map((c) => ({ id: c.id, name: c.name, unreadCount: c.unreadCount }))}
      dms={directory.dms.map((d) => ({
        id: d.id,
        otherName: d.otherName,
        otherAvatarUrl: d.otherAvatarUrl,
        unreadCount: d.unreadCount,
      }))}
      members={directory.members.map((m) => ({
        memberId: m.memberId,
        name: m.name,
        avatarUrl: m.avatarUrl,
      }))}
      myMemberId={directory.myMemberId}
      canPost={directory.canPost}
      initialMessages={messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        authorMemberId: m.authorMemberId,
        authorName: m.authorName,
        authorAvatarUrl: m.authorAvatarUrl,
      }))}
    />
  );
}
