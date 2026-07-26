"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
import type { EventTranslator } from "@/i18n/activity-event";
import { automationLabel } from "@/modules/automation/automation.labels";
import { createAutomationAction, updateAutomationAction } from "@/modules/automation/automation.actions";
import {
  AUTOMATION_TRIGGER_TYPES,
  ACTION_FIELD_SPECS,
  ACTION_TYPES_BY_TRIGGER,
  CONDITION_FIELDS_BY_TRIGGER,
  PROJECT_ONLY_ACTION_TYPES,
  TASK_STATUS_TYPES,
  BLOCKER_STATUS_TYPES,
  PROJECT_ROLE_TYPES,
  AUTOMATION_CONDITION_OPS,
  type ActionFieldType,
  type ConditionValueKind,
} from "@/modules/automation/automation.schema";

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
type Translator = EventTranslator & {
  (key: string, values?: Record<string, string | number>): string;
};

const CONDITION_OPS = AUTOMATION_CONDITION_OPS;
const MAX_CONDITIONS = 15;
const MAX_ACTIONS = 6;

type StatusOption = { id: string; name: string; type: string };
type MemberOption = { id: string; fullName: string };
type BlockerOption = { id: string; title: string };
type TaskOption = { id: string; title: string };
type RiskOption = { id: string; title: string };
type MilestoneOption = { id: string; title: string };
type ChannelOption = { id: string; name: string };

type ConditionDraft = { field: string; op: string; value: string };
type ActionDraft = { type: string; params: Record<string, unknown> };

/** Present when editing an existing rule instead of creating a new one.
 * triggerType is immutable once created (server-enforced — see
 * assertTriggerScoping), so the trigger select is locked in this mode. */
export type AutomationEditTarget = {
  automationId: string;
  name: string;
  description: string | null;
  triggerType: string;
  targetEntityId: string | null;
  conditions: { field: string; op: string; value: unknown }[];
  actions: ActionDraft[];
};

interface Props {
  workspaceId: string;
  /** null = workspace-wide automation. */
  projectId: string | null;
  workspaceSlug: string;
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
  risks: RiskOption[];
  milestones: MilestoneOption[];
  channels: ChannelOption[];
  initialTaskId?: string;
  editing?: AutomationEditTarget;
  onCreated: () => void;
  onCancel: () => void;
}

function conditionValueToDraft(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

export function AutomationForm({
  workspaceId,
  projectId,
  workspaceSlug,
  statuses,
  members,
  blockers,
  tasks,
  risks,
  milestones,
  channels,
  initialTaskId,
  editing,
  onCreated,
  onCancel,
}: Props) {
  const t = useTranslations();
  const actionError = useActionError();
  const triggerLabel = (code: string) =>
    automationLabel(t as unknown as EventTranslator, "trigger", code);

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [triggerType, setTriggerType] = useState<string>(editing?.triggerType ?? AUTOMATION_TRIGGER_TYPES[0]);
  const [scope, setScope] = useState<"all" | "task">(
    editing ? (editing.targetEntityId ? "task" : "all") : initialTaskId ? "task" : "all"
  );
  const [taskFilter, setTaskFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    editing?.targetEntityId ?? initialTaskId ?? null
  );
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    editing?.conditions.map((c) => ({ field: c.field, op: c.op, value: conditionValueToDraft(c.value) })) ?? []
  );

  // Two filters compose: which actions make sense for this trigger (always),
  // further narrowed to non-project-scoped ones on the workspace-wide page.
  const allowedActionTypes = (ACTION_TYPES_BY_TRIGGER[triggerType] ?? []).filter(
    (t) => projectId !== null || !PROJECT_ONLY_ACTION_TYPES.has(t)
  );
  const [actions, setActions] = useState<ActionDraft[]>(
    editing?.actions ?? [{ type: allowedActionTypes[0] ?? "", params: {} }]
  );

  const canScopeToTask = projectId !== null && triggerType.startsWith("task.");
  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(taskFilter.toLowerCase())
  );

  function resetActionParams(index: number, newType: string) {
    setActions((a) => a.map((x, j) => (j === index ? { type: newType, params: {} } : x)));
  }

  function updateActionParam(index: number, key: string, value: unknown) {
    setActions((a) =>
      a.map((x, j) => (j === index ? { ...x, params: { ...x.params, [key]: value } } : x))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("automations.form.nameRequired"));
      return;
    }
    if (scope === "task" && !selectedTaskId) {
      toast.error(t("automations.form.taskRequired"));
      return;
    }

    const parsedConditions = conditions.map((c) => ({
      field: c.field,
      op: c.op,
      value: parseConditionValue(c.value),
    }));

    setSubmitting(true);
    const res = editing
      ? await updateAutomationAction({
          workspaceId,
          projectId,
          slug: workspaceSlug,
          automationId: editing.automationId,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            targetEntityId: scope === "task" ? selectedTaskId : null,
            conditions: parsedConditions,
            actions,
          },
        })
      : await createAutomationAction({
          workspaceId,
          projectId,
          slug: workspaceSlug,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            triggerType,
            targetEntityId: scope === "task" ? selectedTaskId : null,
            conditions: parsedConditions,
            actions,
            isActive: true,
          },
        });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(actionError(res));
      return;
    }
    toast.success(t(editing ? "automations.form.saved" : "automations.form.created"));
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border p-4">
      <Input
        placeholder={t("automations.form.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        placeholder={t("automations.form.descPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div>
        <label className="mb-1 block text-sm font-medium">{t("automations.form.triggerLabel")}</label>
        <select
          className="w-full rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          value={triggerType}
          disabled={!!editing}
          onChange={(e) => {
            const nextTrigger = e.target.value;
            setTriggerType(nextTrigger);
            setConditions([]);
            const nextAllowedActions = (ACTION_TYPES_BY_TRIGGER[nextTrigger] ?? []).filter(
              (t) => projectId !== null || !PROJECT_ONLY_ACTION_TYPES.has(t)
            );
            setActions([{ type: nextAllowedActions[0] ?? "", params: {} }]);
            if (!nextTrigger.startsWith("task.")) setScope("all");
          }}
        >
          {AUTOMATION_TRIGGER_TYPES.map((triggerCode) => (
            <option key={triggerCode} value={triggerCode}>
              {triggerLabel(triggerCode)}
            </option>
          ))}
        </select>
      </div>

      {canScopeToTask && tasks.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">{t("automations.form.scopeLabel")}</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              {t("automations.form.allTasks")}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={scope === "task"}
                onChange={() => setScope("task")}
              />
              {t("automations.form.oneTask")}
            </label>
          </div>
          {scope === "task" && (
            <div className="mt-2 space-y-2">
              <Input
                placeholder={t("automations.form.taskSearchPlaceholder")}
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-border px-3 py-2"
                value={selectedTaskId ?? ""}
                onChange={(e) => setSelectedTaskId(e.target.value || null)}
              >
                <option value="">{t("automations.form.selectTask")}</option>
                {filteredTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">
            {t("automations.form.conditions", {
              count: conditions.length,
              max: MAX_CONDITIONS,
            })}
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={conditions.length >= MAX_CONDITIONS}
            onClick={() => {
              const fieldOptions = CONDITION_FIELDS_BY_TRIGGER[triggerType] ?? [];
              const first = fieldOptions[0];
              setConditions((c) => [
                ...c,
                { field: first?.field ?? "", op: "eq", value: "" },
              ]);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            triggerType={triggerType}
            condition={cond}
            members={members}
            onChange={(next) => setConditions((c) => c.map((x, j) => (j === i ? next : x)))}
            onRemove={() => setConditions((c) => c.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">
            {t("automations.form.actions", { count: actions.length, max: MAX_ACTIONS })}
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={actions.length >= MAX_ACTIONS}
            onClick={() => setActions((a) => [...a, { type: allowedActionTypes[0] ?? "", params: {} }])}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {actions.map((action, i) => (
          <ActionRow
            key={i}
            action={action}
            allowedActionTypes={allowedActionTypes}
            statuses={statuses}
            members={members}
            blockers={blockers}
            tasks={tasks}
            risks={risks}
            milestones={milestones}
            channels={channels}
            onTypeChange={(newType) => resetActionParams(i, newType)}
            onParamChange={(key, value) => updateActionParam(i, key, value)}
            onRemove={() => setActions((a) => a.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <p className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
        {buildSummary(
          t as unknown as Translator,
          triggerType,
          conditions,
          actions,
          scope,
          selectedTaskId,
          tasks,
          members
        )}
      </p>

      <div className="flex gap-2">
        <Button type="submit" variant="dark" disabled={submitting}>
          {t(editing ? "automations.form.save" : "automations.form.create")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function parseConditionValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Same enum → label mapping the guided condition/action controls use, applied
 * to a draft (still-string) condition value for the live text preview below. */
function resolveDraftConditionValue(
  t: Translator,
  valueKind: ConditionValueKind | undefined,
  value: string,
  members: MemberOption[]
): string {
  if (!value) return "";
  if (valueKind === "member") return members.find((m) => m.id === value)?.fullName ?? value;
  if (valueKind === "boolean") return value === "true" ? t("common.yes") : t("common.no");
  if (valueKind === "priority") return t(`task.priority.${value}`);
  if (valueKind === "status-type") return t(`automations.enum.taskStatusType.${value}`);
  if (valueKind === "blocker-status") return t(`automations.enum.blockerStatus.${value}`);
  if (valueKind === "project-role") return t(`automations.enum.projectRole.${value}`);
  return value;
}

/**
 * Live preview of the rule being built. Assembled from parts rather than a
 * single sentence key because the condition and action lists are user-built
 * and variable-length; each part is itself localized.
 */
function buildSummary(
  t: Translator,
  triggerType: string,
  conditions: ConditionDraft[],
  actions: ActionDraft[],
  scope: "all" | "task",
  selectedTaskId: string | null,
  tasks: TaskOption[],
  members: MemberOption[]
): string {
  const scopeLabel =
    scope === "task" && selectedTaskId
      ? t("automations.form.summaryScope", {
          title: tasks.find((task) => task.id === selectedTaskId)?.title ?? "?",
        })
      : "";
  const fieldOptions = CONDITION_FIELDS_BY_TRIGGER[triggerType] ?? [];
  const condLabel = conditions
    .filter((c) => c.field)
    .map((c) => {
      const spec = fieldOptions.find((f) => f.field === c.field);
      const fieldLabel = spec ? t(`automations.field.${spec.labelKey}`) : c.field;
      const opLabel = t(`automations.op.${c.op}`);
      const valueLabel = resolveDraftConditionValue(t, spec?.valueKind, c.value, members);
      return `${fieldLabel} ${opLabel} ${valueLabel}`;
    })
    .join(t("automations.form.conditionJoiner"));
  const actionLabel =
    actions.map((a) => automationLabel(t, "action", a.type)).join(", ") ||
    t("automations.form.noActions");
  return t("automations.form.summary", {
    trigger: automationLabel(t, "trigger", triggerType),
    scope: scopeLabel,
    conditions: condLabel ? t("automations.form.summaryConditions", { conditions: condLabel }) : "",
    actions: actionLabel,
  });
}

function ConditionRow({
  triggerType,
  condition,
  members,
  onChange,
  onRemove,
}: {
  triggerType: string;
  condition: ConditionDraft;
  members: MemberOption[];
  onChange: (next: ConditionDraft) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const fieldOptions = CONDITION_FIELDS_BY_TRIGGER[triggerType] ?? [];
  const selectedSpec = fieldOptions.find((f) => f.field === condition.field);

  return (
    <div className="mb-2 flex gap-2">
      {fieldOptions.length > 0 ? (
        <select
          className="rounded-lg border border-border px-2"
          value={condition.field}
          onChange={(e) => onChange({ ...condition, field: e.target.value, value: "" })}
        >
          {fieldOptions.map((f) => (
            <option key={f.field} value={f.field}>
              {t(`automations.field.${f.labelKey}` as Parameters<typeof t>[0])}
            </option>
          ))}
        </select>
      ) : (
        <Input
          placeholder={t("automations.form.fieldPlaceholder")}
          value={condition.field}
          onChange={(e) => onChange({ ...condition, field: e.target.value })}
        />
      )}
      <select
        className="rounded-lg border border-border px-2"
        value={condition.op}
        onChange={(e) => onChange({ ...condition, op: e.target.value })}
      >
        {CONDITION_OPS.map((op) => (
          <option key={op} value={op}>
            {t(`automations.op.${op}` as Parameters<typeof t>[0])}
          </option>
        ))}
      </select>
      {renderConditionValueInput(
        t as unknown as Translator,
        selectedSpec?.valueKind,
        condition.value,
        members,
        (v) =>
        onChange({ ...condition, value: v })
      )}
      <Button type="button" variant="outline" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function renderConditionValueInput(
  t: Translator,
  valueKind:
    | "status-type"
    | "priority"
    | "member"
    | "blocker-status"
    | "project-role"
    | "date"
    | "number"
    | "boolean"
    | undefined,
  value: string,
  members: MemberOption[],
  onChange: (v: string) => void
) {
  if (valueKind === "date") {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={value === "$now" ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={value === "$now"}
        />
        <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={value === "$now"}
            onChange={(e) => onChange(e.target.checked ? "$now" : "")}
          />
          {t("automations.form.useNow")}
        </label>
      </div>
    );
  }
  if (valueKind === "number") {
    return (
      <Input
        type="number"
        placeholder={t("automations.form.valuePlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (valueKind === "boolean") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        <option value="true">{t("common.yes")}</option>
        <option value="false">{t("common.no")}</option>
      </select>
    );
  }
  if (valueKind === "project-role") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        {PROJECT_ROLE_TYPES.map((r) => (
          <option key={r} value={r}>
            {t(`automations.enum.projectRole.${r}`)}
          </option>
        ))}
      </select>
    );
  }
  if (valueKind === "status-type") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        {TASK_STATUS_TYPES.map((s) => (
          <option key={s} value={s}>
            {t(`automations.enum.taskStatusType.${s}`)}
          </option>
        ))}
      </select>
    );
  }
  if (valueKind === "priority") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        {PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {t(`task.priority.${p}`)}
          </option>
        ))}
      </select>
    );
  }
  if (valueKind === "member") {
    return (
      <select
        className="rounded-lg border border-border px-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("automations.form.selectMember")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.fullName}
          </option>
        ))}
      </select>
    );
  }
  if (valueKind === "blocker-status") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        {BLOCKER_STATUS_TYPES.map((s) => (
          <option key={s} value={s}>
            {t(`automations.enum.blockerStatus.${s}`)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Input
      placeholder={t("automations.form.valuePlaceholder")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ActionRow({
  action,
  allowedActionTypes,
  statuses,
  members,
  blockers,
  tasks,
  risks,
  milestones,
  channels,
  onTypeChange,
  onParamChange,
  onRemove,
}: {
  action: ActionDraft;
  allowedActionTypes: readonly string[];
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
  risks: RiskOption[];
  milestones: MilestoneOption[];
  channels: ChannelOption[];
  onTypeChange: (type: string) => void;
  onParamChange: (key: string, value: unknown) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const specs = ACTION_FIELD_SPECS[action.type] ?? [];

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-border/60 p-2.5">
      <div className="flex gap-2">
        <select
          className="rounded-lg border border-border px-2"
          value={action.type}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          {allowedActionTypes.map((actionCode) => (
            <option key={actionCode} value={actionCode}>
              {automationLabel(t as unknown as EventTranslator, "action", actionCode)}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {specs.map((spec) => (
        <ActionFieldControl
          key={spec.key}
          spec={spec}
          value={action.params[spec.key]}
          statuses={statuses}
          members={members}
          blockers={blockers}
          tasks={tasks}
          risks={risks}
          milestones={milestones}
          channels={channels}
          onChange={(v) => onParamChange(spec.key, v)}
        />
      ))}
    </div>
  );
}

function ActionFieldControl({
  spec,
  value,
  statuses,
  members,
  blockers,
  tasks,
  risks,
  milestones,
  channels,
  onChange,
}: {
  spec: { key: string; labelKey: string; type: ActionFieldType };
  value: unknown;
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
  risks: RiskOption[];
  milestones: MilestoneOption[];
  channels: ChannelOption[];
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations();
  const label = t(`automations.field.${spec.labelKey}` as Parameters<typeof t>[0]);
  const strValue = typeof value === "string" ? value : value != null ? String(value) : "";

  if (spec.type === "select-status") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-priority") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {t(`task.priority.${p}` as Parameters<typeof t>[0])}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-member") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.fullName}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-blocker") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {blockers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-task") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-risk") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {risks.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-milestone") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label}</option>
        {milestones.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "select-chat-target") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{label}</option>
        {channels.length > 0 && (
          <optgroup label={t("automations.field.chatTargetChannels")}>
            {channels.map((c) => (
              <option key={c.id} value={`channel:${c.id}`}>
                #{c.name}
              </option>
            ))}
          </optgroup>
        )}
        {members.length > 0 && (
          <optgroup label={t("automations.field.chatTargetMembers")}>
            {members.map((m) => (
              <option key={m.id} value={`member:${m.id}`}>
                {m.fullName}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    );
  }
  if (spec.type === "date") {
    return (
      <Input
        type="date"
        placeholder={label}
        value={strValue}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    );
  }
  if (spec.type === "number") {
    return (
      <Input
        type="number"
        placeholder={label}
        value={strValue}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }
  if (spec.type === "textarea") {
    return <Textarea placeholder={label} value={strValue} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Input placeholder={label} value={strValue} onChange={(e) => onChange(e.target.value)} />;
}
