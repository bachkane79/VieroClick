"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
import { activityEventKey, type EventTranslator } from "@/i18n/activity-event";
import { automationLabel } from "@/modules/automation/automation.labels";
import {
  ACTION_FIELD_SPECS,
  CONDITION_FIELDS_BY_TRIGGER,
  type ActionFieldSpec,
  type ConditionValueKind,
} from "@/modules/automation/automation.schema";
import {
  deleteAutomationAction,
  retryAutomationRunAction,
  toggleAutomationAction,
} from "@/modules/automation/automation.actions";
import { AutomationForm } from "./automation-form";

interface RunRow {
  id: string;
  status: string;
  chainDepth: number;
  startedAt: Date | string;
  error: string | null;
}

interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  isActive: boolean;
  targetEntityId: string | null;
  conditions: { field: string; op: string; value: unknown }[];
  actions: { type: string; params: Record<string, unknown> }[];
  recentRuns: RunRow[];
}

interface StatusOption {
  id: string;
  name: string;
  type: string;
}
interface MemberOption {
  id: string;
  fullName: string;
}
interface BlockerOption {
  id: string;
  title: string;
}
interface TaskOption {
  id: string;
  title: string;
}
interface RiskOption {
  id: string;
  title: string;
}
interface MilestoneOption {
  id: string;
  title: string;
}
interface ChannelOption {
  id: string;
  name: string;
}

type OptionLists = {
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
  risks: RiskOption[];
  milestones: MilestoneOption[];
  channels: ChannelOption[];
};

/** Resolves a stored condition value (already JSON-parsed — string, number,
 * boolean…) to a human-readable, locale-matching string for the read-only
 * detail view — mirrors the option labels the condition builder itself uses. */
function resolveConditionValue(
  t: (key: string) => string,
  valueKind: ConditionValueKind | undefined,
  value: unknown,
  members: MemberOption[]
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (valueKind === "member") {
    return members.find((m) => m.id === value)?.fullName ?? String(value);
  }
  if (valueKind === "boolean") return value ? t("common.yes") : t("common.no");
  if (valueKind === "priority") return t(`task.priority.${value}`);
  if (valueKind === "status-type") return t(`automations.enum.taskStatusType.${value}`);
  if (valueKind === "blocker-status") return t(`automations.enum.blockerStatus.${value}`);
  if (valueKind === "project-role") return t(`automations.enum.projectRole.${value}`);
  return String(value);
}

/** Resolves a stored action param (an id for select-* fields) to the
 * matching option's display name for the read-only detail view. */
function resolveActionParamValue(spec: ActionFieldSpec, value: unknown, lists: OptionLists): string {
  if (value === null || value === undefined || value === "") return "—";
  const id = String(value);
  switch (spec.type) {
    case "select-status":
      return lists.statuses.find((s) => s.id === id)?.name ?? id;
    case "select-member":
      return lists.members.find((m) => m.id === id)?.fullName ?? id;
    case "select-blocker":
      return lists.blockers.find((b) => b.id === id)?.title ?? id;
    case "select-task":
      return lists.tasks.find((x) => x.id === id)?.title ?? id;
    case "select-risk":
      return lists.risks.find((r) => r.id === id)?.title ?? id;
    case "select-milestone":
      return lists.milestones.find((m) => m.id === id)?.title ?? id;
    case "select-chat-target": {
      const [kind, targetId = ""] = id.split(":", 2);
      if (kind === "channel") return `#${lists.channels.find((c) => c.id === targetId)?.name ?? targetId}`;
      if (kind === "member") return lists.members.find((m) => m.id === targetId)?.fullName ?? targetId;
      return id;
    }
    default:
      return id;
  }
}

interface Props {
  workspaceId: string;
  /** null = workspace-wide automations page (no single owning project). */
  projectId: string | null;
  workspaceSlug: string;
  initialAutomations: AutomationRow[];
  statuses?: StatusOption[];
  members?: MemberOption[];
  blockers?: BlockerOption[];
  tasks?: TaskOption[];
  risks?: RiskOption[];
  milestones?: MilestoneOption[];
  channels?: ChannelOption[];
  initialTaskId?: string;
}

export function AutomationsViewClient({
  workspaceId,
  projectId,
  workspaceSlug,
  initialAutomations,
  statuses = [],
  members = [],
  blockers = [],
  tasks = [],
  risks = [],
  milestones = [],
  channels = [],
  initialTaskId,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const format = useFormatter();
  const actionError = useActionError();
  const [automations, setAutomations] = useState(initialAutomations);
  // router.refresh() re-runs the server component and gives us a fresh
  // `initialAutomations` array, but useState only reads it on first mount —
  // without this the freshly-created automation stays invisible until the
  // page is hard-reloaded.
  useEffect(() => {
    setAutomations(initialAutomations);
  }, [initialAutomations]);
  /**
   * Trigger codes are dotted (`task.status_changed`) and next-intl treats `.`
   * as a namespace separator, so they are camelized into a catalog leaf the
   * same way activity-event types are. Unknown codes fall back to the raw code.
   */
  const triggerLabel = (code: string) => {
    const key = `automations.trigger.${activityEventKey(code)}`;
    return t.has(key as Parameters<typeof t.has>[0]) ? t(key as Parameters<typeof t>[0]) : code;
  };
  const [showForm, setShowForm] = useState(!!initialTaskId);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const optionLists: OptionLists = { statuses, members, blockers, tasks, risks, milestones, channels };

  async function handleToggle(automationId: string, isActive: boolean) {
    setAutomations((current) =>
      current.map((a) => (a.id === automationId ? { ...a, isActive } : a))
    );
    const res = await toggleAutomationAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationId,
      isActive,
    });
    if (!res.ok) {
      toast.error(actionError(res));
      setAutomations((current) =>
        current.map((a) => (a.id === automationId ? { ...a, isActive: !isActive } : a))
      );
    }
  }

  async function handleDelete(automationId: string) {
    if (!confirm(t("automations.deleteConfirm"))) return;
    const previous = automations;
    setAutomations((current) => current.filter((a) => a.id !== automationId));
    const res = await deleteAutomationAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationId,
    });
    if (!res.ok) {
      toast.error(actionError(res));
      setAutomations(previous);
    } else {
      toast.success(t("automations.toast.deleted"));
      router.refresh();
    }
  }

  async function handleRetry(automationRunId: string) {
    setRetryingRunId(automationRunId);
    const res = await retryAutomationRunAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      automationRunId,
    });
    setRetryingRunId(null);
    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    toast.success(t("automations.toast.retryFinished", { result: String(res.data) }));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold tracking-[-0.014em]">{t("automations.title")}</h2>
        </div>
        <Button variant="dark" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> {t("automations.new")}
        </Button>
      </div>

      {showForm && (
        <AutomationForm
          workspaceId={workspaceId}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          statuses={statuses}
          members={members}
          blockers={blockers}
          tasks={tasks}
          risks={risks}
          milestones={milestones}
          channels={channels}
          initialTaskId={initialTaskId}
          onCreated={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {automations.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("automations.empty")}</p>
        )}
        {automations.map((automation) =>
          editingId === automation.id ? (
            <AutomationForm
              key={automation.id}
              workspaceId={workspaceId}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              statuses={statuses}
              members={members}
              blockers={blockers}
              tasks={tasks}
              risks={risks}
              milestones={milestones}
              channels={channels}
              editing={{
                automationId: automation.id,
                name: automation.name,
                description: automation.description,
                triggerType: automation.triggerType,
                targetEntityId: automation.targetEntityId,
                conditions: automation.conditions,
                actions: automation.actions,
              }}
              onCreated={() => {
                setEditingId(null);
                router.refresh();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
          <div key={automation.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{automation.name}</div>
                <div className="text-sm text-muted-foreground">
                  {triggerLabel(automation.triggerType)} ·{" "}
                  {t("automations.summary", {
                    actions: automation.actions.length,
                    conditions: automation.conditions.length,
                  })}
                  {automation.targetEntityId && ` · ${t("automations.scopedToTask")}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={automation.isActive}
                    onChange={(e) => handleToggle(automation.id, e.target.checked)}
                  />
                  {t("automations.active")}
                </label>
                <Button
                  variant="outline"
                  onClick={() => setExpandedId((id) => (id === automation.id ? null : automation.id))}
                >
                  {expandedId === automation.id ? (
                    <ChevronDown className="mr-1 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-1 h-4 w-4" />
                  )}
                  {expandedId === automation.id ? t("automations.hideDetails") : t("automations.details")}
                </Button>
                <Button variant="outline" onClick={() => setEditingId(automation.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => handleDelete(automation.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {expandedId === automation.id && (
              <div className="mt-3 space-y-3 rounded-lg bg-surface-subtle p-3 text-sm">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("automations.detail.conditionsTitle")}
                  </div>
                  {automation.conditions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("automations.detail.noConditions")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {automation.conditions.map((cond, i) => {
                        const spec = (CONDITION_FIELDS_BY_TRIGGER[automation.triggerType] ?? []).find(
                          (f) => f.field === cond.field
                        );
                        const fieldLabel = spec
                          ? t(`automations.field.${spec.labelKey}` as Parameters<typeof t>[0])
                          : cond.field;
                        return (
                          <li key={i}>
                            <span className="font-medium">{fieldLabel}</span>{" "}
                            <span className="text-muted-foreground">
                              {t(`automations.op.${cond.op}` as Parameters<typeof t>[0])}
                            </span>{" "}
                            {resolveConditionValue(
                              t as unknown as (key: string) => string,
                              spec?.valueKind,
                              cond.value,
                              members
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("automations.detail.actionsTitle")}
                  </div>
                  <ul className="space-y-1">
                    {automation.actions.map((action, i) => {
                      const specs = ACTION_FIELD_SPECS[action.type] ?? [];
                      return (
                        <li key={i}>
                          <span className="font-medium">
                            {automationLabel(t as unknown as EventTranslator, "action", action.type)}
                          </span>
                          {specs.length > 0 && (
                            <span className="text-muted-foreground">
                              {": "}
                              {specs
                                .map((spec) => {
                                  const paramLabel = t(
                                    `automations.field.${spec.labelKey}` as Parameters<typeof t>[0]
                                  );
                                  const paramValue = resolveActionParamValue(
                                    spec,
                                    action.params[spec.key],
                                    optionLists
                                  );
                                  return `${paramLabel}=${paramValue}`;
                                })
                                .join(", ")}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {automation.recentRuns.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pr-4">{t("automations.runs.status")}</th>
                    <th className="pr-4">{t("automations.runs.depth")}</th>
                    <th className="pr-4">{t("automations.runs.started")}</th>
                    <th className="pr-4">{t("automations.runs.error")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {automation.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="pr-4">{run.status}</td>
                      <td className="pr-4">{run.chainDepth}</td>
                      <td className="pr-4">{format.dateTime(new Date(run.startedAt), "dateTime")}</td>
                      <td className="max-w-[200px] truncate pr-4">{run.error ?? ""}</td>
                      <td>
                        {(run.status === "failed" || run.status === "timed_out") && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            disabled={retryingRunId === run.id}
                            onClick={() => handleRetry(run.id)}
                          >
                            {retryingRunId === run.id ? t("automations.retrying") : t("automations.retry")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )
        )}
      </div>
    </div>
  );
}
