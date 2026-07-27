import { redirect } from "next/navigation";

export default async function WorkloadRedirect({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  redirect(`/workspace/${slug}/projects/${projectId}/analytics`);
}
