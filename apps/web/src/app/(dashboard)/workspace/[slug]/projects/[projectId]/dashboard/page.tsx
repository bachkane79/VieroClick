import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

/**
 * "Trang tổng quan" was merged into "Tổng quan" (redesign v2) — the live
 * dashboard panels now render inside the Overview tab. Keep this route as a
 * redirect so existing links / bookmarks resolve.
 */
export default async function ProjectDashboardRedirect({ params }: Props) {
  const { slug, projectId } = await params;
  redirect(`/workspace/${slug}/projects/${projectId}/overview`);
}
