import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { buttonVariants, cn } from "@vieroc/ui";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { getProject } from "@/modules/project/project.service";
import { ForbiddenError, NotFoundError } from "@/server/lib/errors";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dict";
import { ProjectNav } from "./project-nav";
import { AgentActivityTray } from "./agent-activity-tray";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string; projectId: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { slug, projectId } = await params;

  let workspace;
  let project;
  try {
    workspace = await getWorkspace(slug);
    project = await getProject(workspace.id, projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    // No access → render a proper permission-denied state (§12) instead of
    // crashing. The layout wraps every project sub-page, so bailing here keeps
    // the children (which would re-throw the same error) from rendering.
    if (err instanceof ForbiddenError) return <ProjectAccessDenied slug={slug} />;
    throw err;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas text-foreground">
      {/* Context header: Workspace / Projects / Name + status (redesign §11.3) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link
            href={`/workspace/${slug}/projects`}
            className="shrink-0 font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            {workspace.name}
          </Link>
          <span className="text-text-secondary/60">/</span>
          <Link
            href={`/workspace/${slug}/projects`}
            className="shrink-0 font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <span className="text-text-secondary/60">/</span>
          <span className="truncate text-[15px] font-semibold text-foreground">{project.name}</span>
          <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-border-strong bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold capitalize text-text-secondary">
            {project.status}
          </span>
        </nav>
        {project.description && (
          <p className="hidden max-w-md truncate text-xs text-text-secondary lg:block">
            {project.description}
          </p>
        )}
      </div>

      {/* View tabs */}
      <ProjectNav slug={slug} projectId={projectId} />

      {/* Content Area */}
      <div className="flex-1 min-h-0">{children}</div>
      <AgentActivityTray projectId={projectId} />
    </div>
  );
}

/** Permission-denied surface (§12) — explains the missing access, never a
 *  fake empty state. Rendered when the viewer isn't a member of the project. */
async function ProjectAccessDenied({ slug }: { slug: string }) {
  const locale = await getLocale();
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-secondary">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">{t(locale, "perm.denied.title")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-text-secondary">
          {t(locale, "perm.denied.body")}
        </p>
        <Link
          href={`/workspace/${slug}/projects`}
          className={cn(buttonVariants(), "mt-6")}
        >
          {t(locale, "perm.denied.back")}
        </Link>
      </div>
    </div>
  );
}
