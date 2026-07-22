"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle, Flag, MoreHorizontal, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@vieroc/ui";
import {
  assignTaskAction,
  changeTaskStatusAction,
  updateTaskAction,
} from "../task.actions";
import { PRIORITY_FLAG_COLORS, PRIORITY_ORDER, statusColor } from "../status-colors";
import type { MemberOptionView, TaskStatusView, TaskView } from "../task.view";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  task: TaskView;
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  /** Apply an optimistic patch to local state; called again with `null` patch to roll back. */
  onOptimistic: (taskId: string, patch: Partial<TaskView> | null) => void;
  className?: string;
}

const menuContentClass =
  "z-50 min-w-[190px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md";
const menuItemClass =
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

export function TaskQuickActions({
  workspaceId,
  workspaceSlug,
  projectId,
  task,
  statuses,
  members,
  onOptimistic,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  async function changeStatus(statusId: string) {
    if (statusId === task.statusId) return;
    onOptimistic(task.id, { statusId });
    const result = await changeTaskStatusAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      statusId,
    });
    if (!result.ok) {
      onOptimistic(task.id, null);
      toast.error(result.error);
    }
  }

  async function changeAssignee(memberId: string | null) {
    if ((memberId ?? null) === task.assigneeMemberId) return;
    onOptimistic(task.id, { assigneeMemberId: memberId });
    const result = await assignTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      memberId,
    });
    if (!result.ok) {
      onOptimistic(task.id, null);
      toast.error(result.error);
    }
  }

  async function changePriority(priority: TaskView["priority"]) {
    if (priority === task.priority) return;
    onOptimistic(task.id, { priority });
    const result = await updateTaskAction({
      workspaceId,
      projectId,
      slug: workspaceSlug,
      taskId: task.id,
      data: { priority, version: task.version },
    });
    if (!result.ok) {
      onOptimistic(task.id, null);
      if (result.code === "conflict") {
        toast.error("This task was updated by someone else — please reload.");
      } else {
        toast.error(result.error);
      }
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Task quick actions"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
            className
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={menuContentClass}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClass}>
              <Circle className="h-3.5 w-3.5" />
              Status
              <ChevronRight className="ml-auto h-3.5 w-3.5" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={6} className={menuContentClass}>
                {statuses.map((status) => (
                  <DropdownMenu.Item
                    key={status.id}
                    className={menuItemClass}
                    onSelect={() => changeStatus(status.id)}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-sm", statusColor(status.type).dot)} />
                    {status.name}
                    {status.id === task.statusId && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClass}>
              <UserRound className="h-3.5 w-3.5" />
              Assignee
              <ChevronRight className="ml-auto h-3.5 w-3.5" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={6} className={menuContentClass}>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => changeAssignee(null)}
                >
                  <span className="text-muted-foreground">Unassigned</span>
                  {!task.assigneeMemberId && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenu.Item>
                {members.map((member) => (
                  <DropdownMenu.Item
                    key={member.id}
                    className={menuItemClass}
                    onSelect={() => changeAssignee(member.id)}
                  >
                    {member.fullName}
                    {member.id === task.assigneeMemberId && (
                      <Check className="ml-auto h-3.5 w-3.5" />
                    )}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClass}>
              <Flag className="h-3.5 w-3.5" />
              Priority
              <ChevronRight className="ml-auto h-3.5 w-3.5" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={6} className={menuContentClass}>
                {PRIORITY_ORDER.map((priority) => (
                  <DropdownMenu.Item
                    key={priority}
                    className={menuItemClass}
                    onSelect={() => changePriority(priority)}
                  >
                    <Flag className={cn("h-3.5 w-3.5", PRIORITY_FLAG_COLORS[priority])} />
                    <span className="capitalize">{priority}</span>
                    {priority === task.priority && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
