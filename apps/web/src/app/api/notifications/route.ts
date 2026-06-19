import { NextResponse } from "next/server";
import { db, notifications } from "@vieroc/db";
import { getUserId } from "@/server/lib/context";
import { isAgentRequest } from "@/server/lib/agent-auth";

export async function POST(request: Request) {
  try {
    // Accept agent service key OR user session
    if (!isAgentRequest(request)) {
      await getUserId();
    }
    const body = await request.json();
    const {
      workspaceId,
      recipientMemberId,
      projectId,
      type,
      title,
      body: textBody,
      metadata,
    } = body;

    if (!workspaceId || !recipientMemberId || !type || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [notification] = await db
      .insert(notifications)
      .values({
        workspaceId,
        recipientMemberId,
        projectId: projectId || null,
        type,
        title,
        body: textBody || null,
        metadata: metadata || {},
        isRead: false,
      })
      .returning();

    return NextResponse.json(notification, { status: 201 });
  } catch (err: any) {
    console.error("Error creating notification in API:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
