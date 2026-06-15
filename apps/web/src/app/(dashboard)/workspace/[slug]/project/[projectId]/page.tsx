import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function LegacyProjectPage({ params }: Props) {
  const { slug, projectId } = await params;
  redirect(`/workspace/${slug}/projects/${projectId}/overview`);
}
