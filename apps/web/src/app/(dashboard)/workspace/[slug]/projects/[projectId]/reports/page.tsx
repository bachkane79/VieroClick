import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

/**
 * The standalone "Báo cáo" tab was merged into "Rủi ro & Cột mốc" as the
 * manager-only "Tổng hợp báo cáo" sub-tab (redesign v2). Keep this route as a
 * redirect so existing links / bookmarks resolve.
 */
export default async function ProjectReportsRedirect({ params }: Props) {
  const { slug, projectId } = await params;
  redirect(`/workspace/${slug}/projects/${projectId}/risks-milestones`);
}
