"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@vieroc/ui";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listDeletedTasksAction, restoreTaskAction } from "../task.actions";

interface DeletedTask {
  id: string;
  title: string;
  deletedAt: Date | null;
}

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
}

/** WP-D4: minimal "Trash" surface — list soft-deleted tasks and restore them. */
export function DeletedTasksPanel({ workspaceId, workspaceSlug, projectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DeletedTask[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const result = await listDeletedTasksAction({ workspaceId, projectId });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems(result.data);
  }

  async function restore(taskId: string) {
    setRestoringId(taskId);
    const result = await restoreTaskAction({ workspaceId, projectId, slug: workspaceSlug, taskId });
    setRestoringId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Task restored");
    setItems((prev) => (prev ? prev.filter((t) => t.id !== taskId) : prev));
    router.refresh();
  }

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5" />
          Deleted tasks
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 max-h-80 w-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {loading && <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>}
          {!loading && items?.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No deleted tasks.</p>
          )}
          {!loading &&
            items?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[11px]"
                  disabled={restoringId === task.id}
                  onClick={() => restore(task.id)}
                >
                  Restore
                </Button>
              </div>
            ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
