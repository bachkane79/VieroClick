"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
import type { EventTranslator } from "@/i18n/activity-event";
import { automationLabel } from "@/modules/automation/automation.labels";
import { createAutomationAction } from "@/modules/automation/automation.actions";
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

type ConditionDraft = { field: string; op: string; value: string };
type ActionDraft = { type: string; params: Record<string, unknown> };

interface Props {
  workspaceId: string;
  /** null = workspace-wide automation. */
  projectId: string | null;
  workspaceSlug: string;
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
  initialTaskId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function AutomationForm({
  workspaceId,
  projectId,
  workspaceSlug,
  statuses,
  members,
  blockers,
  tasks,
  initialTaskId,
  onCreated,
  onCancel,
}: Props) {
  const t = useTranslations();
  const actionError = useActionError();
  const triggerLabel = (code: string) =>
    automationLabel(t as unknown as EventTranslator, "trigger", code);

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<string>(AUTOMATION_TRIGGER_TYPES[0]);
  const [scope, setScope] = useState<"all" | "task">(initialTaskId ? "task" : "all");
  const [taskFilter, setTaskFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId ?? null);
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);

  // Two filters compose: which actions make sense for this trigger (always),
  // further narrowed to non-project-scoped ones on the workspace-wide page.
  const allowedActionTypes = (ACTION_TYPES_BY_TRIGGER[triggerType] ?? []).filter(
    (t) => projectId !== null || !PROJECT_ONLY_ACTION_TYPES.has(t)
  );
  const [actions, setActions] = useState<ActionDraft[]>([{ type: allowedActionTypes[0] ?? "", params: {} }]);

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
    const res = await createAutomationAction({
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
    toast.success(t("automations.form.created"));
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
          className="w-full rounded-lg border border-border px-3 py-2"
          value={triggerType}
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
            onTypeChange={(newType) => resetActionParams(i, newType)}
            onParamChange={(key, value) => updateActionParam(i, key, value)}
            onRemove={() => setActions((a) => a.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <p className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
        {buildSummary(t as unknown as Translator, triggerType, conditions, actions, scope, selectedTaskId, tasks)}
      </p>

      <div className="flex gap-2">
        <Button type="submit" variant="dark" disabled={submitting}>
          {t("automations.form.create")}
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
  tasks: TaskOption[]
): string {
  const scopeLabel =
    scope === "task" && selectedTaskId
      ? t("automations.form.summaryScope", {
          title: tasks.find((task) => task.id === selectedTaskId)?.title ?? "?",
        })
      : "";
  const condLabel = conditions
    .filter((c) => c.field)
    .map((c) => `${c.field} ${c.op} ${c.value}`)
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
            {op}
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
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (valueKind === "project-role") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("automations.form.select")}</option>
        {PROJECT_ROLE_TYPES.map((r) => (
          <option key={r} value={r}>
            {r}
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
            {s}
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
            {p}
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
            {s}
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
  onChange,
}: {
  spec: { key: string; labelKey: string; type: ActionFieldType };
  value: unknown;
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  tasks: TaskOption[];
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
            {p}
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
