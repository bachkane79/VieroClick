"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@vieroc/ui";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createAutomationAction } from "@/modules/automation/automation.actions";
import {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_ACTION_LABELS,
  ACTION_FIELD_SPECS,
  CONDITION_FIELDS_BY_TRIGGER,
  PROJECT_ONLY_ACTION_TYPES,
  TASK_STATUS_TYPES,
  BLOCKER_STATUS_TYPES,
  type ActionFieldType,
} from "@/modules/automation/automation.schema";

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const CONDITION_OPS = ["eq", "neq", "in", "gt", "lt", "contains"];
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
  const allowedActionTypes = projectId
    ? AUTOMATION_ACTION_TYPES
    : AUTOMATION_ACTION_TYPES.filter((t) => !PROJECT_ONLY_ACTION_TYPES.has(t));

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<string>(AUTOMATION_TRIGGER_TYPES[0]);
  const [scope, setScope] = useState<"all" | "task">(initialTaskId ? "task" : "all");
  const [taskFilter, setTaskFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId ?? null);
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([{ type: allowedActionTypes[0], params: {} }]);

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
      toast.error("Vui lòng nhập tên automation");
      return;
    }
    if (scope === "task" && !selectedTaskId) {
      toast.error("Vui lòng chọn 1 task cụ thể");
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
      toast.error(res.error);
      return;
    }
    toast.success("Đã tạo automation");
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border p-4">
      <Input placeholder="Tên automation" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea
        placeholder="Mô tả (tuỳ chọn)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div>
        <label className="mb-1 block text-sm font-medium">Khi nào (Trigger)</label>
        <select
          className="w-full rounded-lg border border-border px-3 py-2"
          value={triggerType}
          onChange={(e) => {
            setTriggerType(e.target.value);
            setConditions([]);
            if (!e.target.value.startsWith("task.")) setScope("all");
          }}
        >
          {AUTOMATION_TRIGGER_TYPES.map((t) => (
            <option key={t} value={t}>
              {AUTOMATION_TRIGGER_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>

      {canScopeToTask && tasks.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Phạm vi áp dụng</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              Tất cả task trong dự án
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={scope === "task"}
                onChange={() => setScope("task")}
              />
              Chỉ 1 task cụ thể
            </label>
          </div>
          {scope === "task" && (
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Tìm task theo tên…"
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-border px-3 py-2"
                value={selectedTaskId ?? ""}
                onChange={(e) => setSelectedTaskId(e.target.value || null)}
              >
                <option value="">— Chọn task —</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
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
            Điều kiện ({conditions.length}/{MAX_CONDITIONS})
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
            Hành động ({actions.length}/{MAX_ACTIONS})
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={actions.length >= MAX_ACTIONS}
            onClick={() => setActions((a) => [...a, { type: allowedActionTypes[0], params: {} }])}
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
            onTypeChange={(newType) => resetActionParams(i, newType)}
            onParamChange={(key, value) => updateActionParam(i, key, value)}
            onRemove={() => setActions((a) => a.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <p className="rounded-lg bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
        {buildSummary(triggerType, conditions, actions, scope, selectedTaskId, tasks)}
      </p>

      <div className="flex gap-2">
        <Button type="submit" variant="dark" disabled={submitting}>
          Tạo automation
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Huỷ
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

function buildSummary(
  triggerType: string,
  conditions: ConditionDraft[],
  actions: ActionDraft[],
  scope: "all" | "task",
  selectedTaskId: string | null,
  tasks: TaskOption[]
): string {
  const triggerLabel = AUTOMATION_TRIGGER_LABELS[triggerType] ?? triggerType;
  const scopeLabel =
    scope === "task" && selectedTaskId
      ? ` (chỉ task "${tasks.find((t) => t.id === selectedTaskId)?.title ?? "?"}")`
      : "";
  const condLabel = conditions
    .filter((c) => c.field)
    .map((c) => `${c.field} ${c.op} ${c.value}`)
    .join(" và ");
  const actionLabel = actions.map((a) => AUTOMATION_ACTION_LABELS[a.type] ?? a.type).join(", ") || "…";
  return `Khi ${triggerLabel}${scopeLabel}${condLabel ? ` và ${condLabel}` : ""} → ${actionLabel}`;
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
              {f.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          placeholder="field (vd: after.statusType)"
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
      {renderConditionValueInput(selectedSpec?.valueKind, condition.value, members, (v) =>
        onChange({ ...condition, value: v })
      )}
      <Button type="button" variant="outline" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function renderConditionValueInput(
  valueKind: "status-type" | "priority" | "member" | "blocker-status" | undefined,
  value: string,
  members: MemberOption[],
  onChange: (v: string) => void
) {
  if (valueKind === "status-type") {
    return (
      <select className="rounded-lg border border-border px-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— chọn —</option>
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
        <option value="">— chọn —</option>
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
        <option value="">— chọn thành viên —</option>
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
        <option value="">— chọn —</option>
        {BLOCKER_STATUS_TYPES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }
  return <Input placeholder="value" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function ActionRow({
  action,
  allowedActionTypes,
  statuses,
  members,
  blockers,
  onTypeChange,
  onParamChange,
  onRemove,
}: {
  action: ActionDraft;
  allowedActionTypes: readonly string[];
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  onTypeChange: (type: string) => void;
  onParamChange: (key: string, value: unknown) => void;
  onRemove: () => void;
}) {
  const specs = ACTION_FIELD_SPECS[action.type] ?? [];

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-border/60 p-2.5">
      <div className="flex gap-2">
        <select
          className="rounded-lg border border-border px-2"
          value={action.type}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          {allowedActionTypes.map((t) => (
            <option key={t} value={t}>
              {AUTOMATION_ACTION_LABELS[t] ?? t}
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
  onChange,
}: {
  spec: { key: string; label: string; type: ActionFieldType };
  value: unknown;
  statuses: StatusOption[];
  members: MemberOption[];
  blockers: BlockerOption[];
  onChange: (v: unknown) => void;
}) {
  const strValue = typeof value === "string" ? value : value != null ? String(value) : "";

  if (spec.type === "select-status") {
    return (
      <select
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{spec.label}</option>
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
        <option value="">{spec.label}</option>
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
        <option value="">{spec.label}</option>
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
        <option value="">{spec.label}</option>
        {blockers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "number") {
    return (
      <Input
        type="number"
        placeholder={spec.label}
        value={strValue}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }
  if (spec.type === "textarea") {
    return <Textarea placeholder={spec.label} value={strValue} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Input placeholder={spec.label} value={strValue} onChange={(e) => onChange(e.target.value)} />;
}
