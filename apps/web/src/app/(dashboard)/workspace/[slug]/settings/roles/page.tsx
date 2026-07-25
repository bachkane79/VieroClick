import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Minus, Lock, Info } from "lucide-react";
import type { WorkspaceRole, PermissionLevel } from "@vieroc/types";
import type { ActorContext } from "@/server/lib/context";
import {
  isWorkspaceAdmin,
  isProjectManager,
  canCreateProject,
  isReviewer,
  roleDefaultLevel,
} from "@/server/lib/permissions";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { NotFoundError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ slug: string }>;
}

// The workspace roles we describe, ordered strongest → weakest.
const ROLE_ORDER: WorkspaceRole[] = ["owner", "admin", "leader", "member", "viewer", "guest"];

/** Build a workspace-level synthetic actor (no project context) for a role. */
function ctxFor(role: WorkspaceRole): ActorContext {
  return {
    userId: "",
    workspaceId: "",
    workspaceMemberId: "",
    workspaceRole: role,
    projectId: null,
    projectRole: null,
  };
}

// Management capabilities, evaluated against the REAL predicates in
// server/lib/permissions.ts so this table can never drift from enforcement.
const CAPABILITIES: {
  key: "admin" | "createProject" | "manage" | "review" | "ai";
  test: (c: ActorContext) => boolean;
}[] = [
  { key: "admin", test: isWorkspaceAdmin },
  { key: "createProject", test: canCreateProject },
  { key: "manage", test: isProjectManager },
  { key: "review", test: isReviewer },
  { key: "ai", test: isProjectManager },
];

// Visual styling per level — copy lives in the message catalog (roles.level.*).
const LEVEL_CLS: Record<PermissionLevel | "none", string> = {
  full: "border-primary/25 bg-primary/10 text-primary",
  edit: "border-success/30 bg-success/10 text-success",
  comment: "border-warning/30 bg-warning/10 text-warning",
  view: "border-border bg-secondary text-muted-foreground",
  none: "border-dashed border-border bg-transparent text-muted-foreground",
};

function LevelChip({ level, label }: { level: PermissionLevel | "none"; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEVEL_CLS[level]}`}
    >
      {label}
    </span>
  );
}

export default async function WorkspaceRolesSettingsPage({ params }: Props) {
  const { slug } = await params;
  try {
    await getWorkspace(slug);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const t = await getTranslations();

  const roleLevels = ROLE_ORDER.map((role) => ({
    role,
    level: (roleDefaultLevel(ctxFor(role)) ?? "none") as PermissionLevel | "none",
  }));

  const matrix = CAPABILITIES.map((cap) => ({
    ...cap,
    values: ROLE_ORDER.map((role) => cap.test(ctxFor(role))),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("roles.pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("roles.pageSubtitle")}</p>
      </header>

      {/* Two-layer explainer */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("roles.layer1Title")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {t.rich("roles.layer1Body", {
              b: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("roles.layer2Title")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {t.rich("roles.layer2Body", {
              team: (chunks) => (
                <Link
                  href={`/workspace/${slug}/settings/teams`}
                  className="font-medium text-primary hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </section>

      {/* Default access level per role */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{t("roles.defaultLevelTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("roles.defaultLevelDesc")}</p>
        </header>
        <ul className="divide-y divide-border">
          {roleLevels.map((r) => (
            <li key={r.role} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="font-medium text-foreground">{t(`roles.name.${r.role}`)}</p>
                <p className="text-xs text-muted-foreground">{t(`roles.level.${r.level}.desc`)}</p>
              </div>
              <LevelChip level={r.level} label={t(`roles.level.${r.level}.label`)} />
            </li>
          ))}
        </ul>
      </section>

      {/* Capability matrix */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{t("roles.capTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t.rich("roles.capDesc", {
              code: (chunks) => (
                <code className="rounded bg-secondary px-1 py-0.5 text-xs">{chunks}</code>
              ),
            })}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left">{t("roles.capColumn")}</th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} className="px-3 py-3 text-center">
                    {t(`roles.name.${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.map((cap) => (
                <tr key={cap.key} className="transition-colors hover:bg-surface-hover">
                  <td className="px-5 py-3 text-left text-foreground">
                    {t(`roles.cap.${cap.key}`)}
                  </td>
                  {cap.values.map((v, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {v ? (
                        <Check
                          className="mx-auto h-4 w-4 text-success"
                          aria-label={t("common.yes")}
                        />
                      ) : (
                        <Minus
                          className="mx-auto h-4 w-4 text-muted-foreground/40"
                          aria-label={t("common.no")}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The four levels */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("roles.fourLevelsTitle")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(["full", "edit", "comment", "view"] as PermissionLevel[]).map((lvl) => (
            <li key={lvl} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <LevelChip level={lvl} label={t(`roles.level.${lvl}.label`)} />
              <p className="text-sm text-muted-foreground">{t(`roles.level.${lvl}.desc`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("roles.resolveOrder")}
        </p>
      </section>

      {/* Custom roles — migration-gated next step */}
      <section className="rounded-xl border border-dashed border-border bg-surface-subtle p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-secondary p-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("roles.customTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.rich("roles.customDesc", {
                code: (chunks) => (
                  <code className="rounded bg-secondary px-1 py-0.5 text-xs">{chunks}</code>
                ),
              })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
