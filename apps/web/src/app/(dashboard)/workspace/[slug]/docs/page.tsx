import { notFound } from "next/navigation";
import { cn } from "@vieroc/ui";
import { BookOpen, FileText, Layers, Sparkles } from "lucide-react";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { listWorkspaceDocs } from "@/modules/workspace-doc/workspace-doc.service";
import { DocsClient } from "@/modules/workspace-doc/components/docs-client";
import { getTranslations } from "next-intl/server";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ doc?: string }>;
}

export default async function WorkspaceDocsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { doc: initialDocId } = await searchParams;

  let workspace;
  try {
    workspace = await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const docs = await listWorkspaceDocs(workspace.id);
  const t = await getTranslations();
  const rootDocs = docs.filter((d) => !d.parentId).length;
  const subDocs = docs.filter((d) => Boolean(d.parentId)).length;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-6">
      {/* Giant Unified White Shell Container */}
      <div className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-soft lg:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {workspace.name}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            {t("docsHub.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{t("docsHub.subtitle")}</p>
        </div>

        {/* Tinted Stat Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label={t("docsHub.stat.total")}
            value={docs.length}
            accent="primary"
            trend={t("docsHub.trend.knowledge")}
            icon="docs"
          />
          <Stat
            label={t("docsHub.stat.root")}
            value={rootDocs}
            accent="success"
            trend={t("docsHub.trend.root")}
            icon="root"
          />
          <Stat
            label={t("docsHub.stat.sub")}
            value={subDocs}
            accent="peach"
            trend={t("docsHub.trend.sub")}
            icon="sub"
          />
          <Stat
            label={t("docsHub.stat.ai")}
            value={docs.length > 0 ? 100 : 0}
            accent="ai"
            trend={t("docsHub.trend.autoSync")}
            icon="ai"
          />
        </div>

        <DocsClient
          workspaceId={workspace.id}
          workspaceSlug={slug}
          initialDocId={initialDocId ?? null}
          initialDocs={docs.map((d) => ({
            id: d.id,
            parentId: d.parentId,
            title: d.title,
            content: d.content,
            updatedAt: d.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

const DEFAULT_STYLE = {
  text: "text-foreground",
  bg: "bg-card border-border/80",
  badge: "bg-secondary text-muted-foreground",
};

const ACCENT: Record<string, { text: string; bg: string; badge: string }> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/5 border-primary/15",
    badge: "bg-primary/10 text-primary",
  },
  success: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/5 border-emerald-500/15",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  peach: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/5 border-amber-500/15",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  ai: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/5 border-purple-500/15",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
};

const STAT_ICONS: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  docs: { bg: "bg-primary/10", text: "text-primary", icon: BookOpen },
  root: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: FileText },
  sub: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", icon: Layers },
  ai: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", icon: Sparkles },
};

function Stat({
  label,
  value,
  accent,
  trend,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  trend?: string;
  icon?: "docs" | "root" | "sub" | "ai";
}) {
  const style = ACCENT[accent] ?? DEFAULT_STYLE;
  const iconMeta = icon ? STAT_ICONS[icon] : undefined;
  const IconComp = iconMeta?.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        style.bg
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {IconComp && (
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-xs",
                iconMeta.bg,
                iconMeta.text
              )}
            >
              <IconComp className="h-3.5 w-3.5" />
            </span>
          )}
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        </div>
        {trend && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              style.badge
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums tracking-tight", style.text)}>
        {value}
      </p>
    </div>
  );
}
