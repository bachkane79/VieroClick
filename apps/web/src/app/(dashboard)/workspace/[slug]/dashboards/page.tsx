import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listProjects } from "@/modules/project/project.service";
import { NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dict";
import { LayoutDashboard } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Dashboards hub (spec §16.1): one auto-provisioned dashboard per project,
 * listed ClickUp-style as a scannable table (Name / Location / Updated).
 */
export default async function DashboardsHubPage({ params }: Props) {
  const { slug } = await params;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const locale = await getLocale();
  const projects = await listProjects(workspace.id);

  return (
    <div className="px-6 py-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          {t(locale, "dash.hubTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(locale, "dash.hubSub")}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">{t(locale, "dash.name")}</th>
              <th className="px-4 py-2.5">{t(locale, "dash.location")}</th>
              <th className="px-4 py-2.5">{t(locale, "dash.updated")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {projects.map((project) => (
              <tr key={project.id} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/workspace/${slug}/projects/${project.id}/dashboard`}
                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary"
                  >
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {project.name} — Dashboard
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {workspace.name} / {project.name}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {project.updatedAt.toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/workspace/${slug}/projects/${project.id}/dashboard`}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {t(locale, "dash.open")}
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t(locale, "dash.emptyHub")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
