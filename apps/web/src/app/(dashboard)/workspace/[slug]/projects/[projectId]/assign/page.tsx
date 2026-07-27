import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

/**
 * "Giao việc AI" was merged into "AI Manager" (redesign v2) — its assignment
 * generation + review now lives in the AI Manager's "Phân công" sub-tab. Keep
 * this route as a redirect so existing links / bookmarks resolve.
 */
export default async function ProjectAssignRedirect({ params }: Props) {
  const { slug, projectId } = await params;
  redirect(`/workspace/${slug}/projects/${projectId}/ai`);
}
