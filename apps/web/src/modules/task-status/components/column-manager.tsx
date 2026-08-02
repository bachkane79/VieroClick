"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, Input, cn } from "@vieroc/ui";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Columns3, Plus, Star, Trash2, X } from "lucide-react";
import { useActionError } from "@/i18n/use-action-error";
import { statusColor } from "@/modules/task/status-colors";
import type { TaskStatusView } from "@/modules/task/task.view";
import {
  createTaskStatusAction,
  deleteTaskStatusAction,
  updateTaskStatusAction,
} from "../task-status.actions";

const STATUS_TYPES = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

type StatusType = (typeof STATUS_TYPES)[number];

interface Props {
  workspaceId: string;
  projectId: string;
  workspaceSlug: string;
  statuses: TaskStatusView[];
  /** Task count per status id — a column holding work can't be deleted. */
  taskCounts: Record<string, number>;
}

/**
 * Board column CRUD. `createTaskStatus`/`updateTaskStatus`/`deleteTaskStatus`
 * shipped with no UI at all, so a project was stuck with the five seeded
 * columns forever. Manager-only (the service asserts it too).
 */
export function ColumnManager({
  workspaceId,
  projectId,
  workspaceSlug,
  statuses,
  taskCounts,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const actionError = useActionError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<StatusType>("todo");

  const base = { workspaceId, projectId, slug: workspaceSlug };
  const ordered = [...statuses].sort((a, b) => a.position - b.position);

  async function run(fn: () => Promise<{ ok: boolean } & Record<string, unknown>>, okMsg: string) {
    setBusy(true);
    const res = (await fn()) as Awaited<ReturnType<typeof updateTaskStatusAction>>;
    setBusy(false);
    if (!res.ok) {
      toast.error(actionError(res));
      return false;
    }
    toast.success(okMsg);
    router.refresh();
    return true;
  }

  async function rename(statusId: string, name: string) {
    const current = ordered.find((s) => s.id === statusId);
    if (!current || name.trim() === current.name || !name.trim()) return;
    await run(
      () => updateTaskStatusAction({ ...base, statusId, data: { name: name.trim() } }),
      t("board.columns.toast.updated")
    );
  }

  async function setType(statusId: string, type: StatusType) {
    await run(
      () => updateTaskStatusAction({ ...base, statusId, data: { type } }),
      t("board.columns.toast.updated")
    );
  }

  async function makeDefault(statusId: string) {
    await run(
      () => updateTaskStatusAction({ ...base, statusId, data: { isDefault: true } }),
      t("board.columns.toast.defaultSet")
    );
  }

  /** Swap two neighbours' positions — two updates, second only if the first won. */
  async function move(index: number, direction: -1 | 1) {
    const current = ordered[index];
    const neighbour = ordered[index + direction];
    if (!current || !neighbour) return;
    setBusy(true);
    const first = await updateTaskStatusAction({
      ...base,
      statusId: current.id,
      data: { position: neighbour.position },
    });
    if (!first.ok) {
      setBusy(false);
      toast.error(actionError(first));
      return;
    }
    const second = await updateTaskStatusAction({
      ...base,
      statusId: neighbour.id,
      data: { position: current.position },
    });
    setBusy(false);
    if (!second.ok) {
      toast.error(actionError(second));
      return;
    }
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const maxPosition = ordered.reduce((max, s) => Math.max(max, s.position), -1);
    const created = await run(
      () =>
        createTaskStatusAction({
          ...base,
          data: { name: newName.trim(), type: newType, position: maxPosition + 1 },
        }),
      t("board.columns.toast.created")
    );
    if (created) {
      setNewName("");
      setNewType("todo");
    }
  }

  async function remove(statusId: string) {
    await run(
      () => deleteTaskStatusAction({ ...base, statusId }),
      t("board.columns.toast.deleted")
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Columns3 className="h-3.5 w-3.5" />
          {t("board.columns.trigger")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[560px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-elevated focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                <Columns3 className="h-4 w-4 text-primary" />
                {t("board.columns.title")}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                {t("board.columns.description")}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
            {ordered.map((status, index) => {
              const inUse = (taskCounts[status.id] ?? 0) > 0;
              const isLast = ordered.length <= 1;
              return (
                <li
                  key={status.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", statusColor(status.type).dot)}
                  />
                  <Input
                    defaultValue={status.name}
                    disabled={busy}
                    aria-label={t("board.columns.nameLabel")}
                    onBlur={(e) => void rename(status.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className="h-8 min-w-0 flex-1 text-sm"
                  />
                  <select
                    value={status.type}
                    disabled={busy}
                    aria-label={t("board.columns.typeLabel")}
                    onChange={(e) => void setType(status.id, e.target.value as StatusType)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {STATUS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`board.columns.type.${type}`)}
                      </option>
                    ))}
                  </select>
                  <span className="w-10 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                    {taskCounts[status.id] ?? 0}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <IconButton
                      label={t("board.columns.moveUp")}
                      disabled={busy || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={t("board.columns.moveDown")}
                      disabled={busy || index === ordered.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={t("board.columns.makeDefault")}
                      disabled={busy || status.isDefault}
                      onClick={() => void makeDefault(status.id)}
                      className={status.isDefault ? "text-amber-500" : undefined}
                    >
                      <Star
                        className="h-3.5 w-3.5"
                        fill={status.isDefault ? "currentColor" : "none"}
                      />
                    </IconButton>
                    <IconButton
                      label={
                        inUse
                          ? t("board.columns.deleteBlocked")
                          : isLast
                            ? t("board.columns.deleteLast")
                            : t("common.delete")
                      }
                      disabled={busy || inUse || isLast}
                      onClick={() => void remove(status.id)}
                      className="text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("board.columns.newPlaceholder")}
              disabled={busy}
              className="h-8 min-w-0 flex-1 text-sm"
            />
            <select
              value={newType}
              disabled={busy}
              aria-label={t("board.columns.typeLabel")}
              onChange={(e) => setNewType(e.target.value as StatusType)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              {STATUS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`board.columns.type.${type}`)}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={busy || !newName.trim()}>
              <Plus className="h-3.5 w-3.5" />
              {t("common.add")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
        className
      )}
    >
      {children}
    </button>
  );
}
