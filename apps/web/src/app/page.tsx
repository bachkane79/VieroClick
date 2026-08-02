import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { LandingPage } from "@/modules/marketing/components/landing-page";

/**
 * Public root.
 *
 * Signed-in visitors go straight to their workspace; everyone else gets the
 * marketing page. Previously this redirected anonymous traffic to `/login`,
 * which meant the product had no public front door at all.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: "VieroClick — Trợ lý AI quản lý dự án cho đội ngũ Việt",
    description: t("hero.lead"),
  };
}

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return <LandingPage />;
}
