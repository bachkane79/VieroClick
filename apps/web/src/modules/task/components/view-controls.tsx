"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button, cn, Input } from "@vieroc/ui";
import { ArrowUpDown, Bookmark, Check, Filter, Group, Search, X } from "lucide-react";
import type { GroupBy, SortField } from "../task-grouping";
import { PRIORITY_ORDER } from "../status-colors";
import type { MemberOptionView, TaskStatusView } from "../task.view";
import type { SavedView, useViewPrefs } from "./use-view-prefs";

type ViewPrefsApi = ReturnType<typeof useViewPrefs>;

interface Props {
  api: ViewPrefsApi;
  statuses: TaskStatusView[];
  members: MemberOptionView[];
  /** Hide the group-by control on views where grouping isn't meaningful (Calendar). */
  showGroupBy?: boolean;
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "phase", label: "Phase" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "None" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "title", label: "Title" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
];

const menuContent =
  "z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md";
const menuItem =
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent";

export function ViewControls({ api, statuses, members, showGroupBy = true }: Props) {
  const { prefs, setGroupBy, setSort, setFilter, savedViews, saveView, applyView, deleteView, resetPrefs } =
    api;
  const [saveName, setSaveName] = useState("");

  const filterCount =
    prefs.filter.statusIds.length +
    prefs.filter.assigneeIds.length +
    prefs.filter.priorities.length;

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={prefs.filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search tasks…"
          className="h-8 w-44 pl-8 text-sm"
        />
      </div>

      {showGroupBy && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
              <Group className="h-3.5 w-3.5" />
              Group: {GROUP_OPTIONS.find((g) => g.value === prefs.groupBy)?.label}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
              {GROUP_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.value}
                  className={menuItem}
                  onSelect={() => setGroupBy(opt.value)}
                >
                  {opt.label}
                  {prefs.groupBy === opt.value && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort: {SORT_OPTIONS.find((s) => s.value === prefs.sortField)?.label}
            {prefs.sortField !== "manual" && ` (${prefs.sortDir === "asc" ? "↑" : "↓"})`}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenu.Item
                key={opt.value}
                className={menuItem}
                onSelect={() =>
                  setSort(
                    opt.value,
                    // Toggle direction if re-selecting the active field.
                    opt.value === prefs.sortField && prefs.sortDir === "asc" ? "desc" : "asc"
                  )
                }
              >
                {opt.label}
                {prefs.sortField === opt.value && <Check className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant={filterCount ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter{filterCount ? ` (${filterCount})` : ""}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className={cn(menuContent, "max-h-[70vh] overflow-y-auto")}>
            <DropdownMenu.Label className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Status
            </DropdownMenu.Label>
            {statuses.map((s) => (
              <DropdownMenu.CheckboxItem
                key={s.id}
                checked={prefs.filter.statusIds.includes(s.id)}
                onCheckedChange={() =>
                  setFilter((f) => ({ ...f, statusIds: toggle(f.statusIds, s.id) }))
                }
                onSelect={(e) => e.preventDefault()}
                className={menuItem}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                    prefs.filter.statusIds.includes(s.id) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {prefs.filter.statusIds.includes(s.id) && <Check className="h-2.5 w-2.5" />}
                </span>
                {s.name}
              </DropdownMenu.CheckboxItem>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Label className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Priority
            </DropdownMenu.Label>
            {PRIORITY_ORDER.map((p) => (
              <DropdownMenu.CheckboxItem
                key={p}
                checked={prefs.filter.priorities.includes(p)}
                onCheckedChange={() =>
                  setFilter((f) => ({ ...f, priorities: toggle(f.priorities, p) }))
                }
                onSelect={(e) => e.preventDefault()}
                className={cn(menuItem, "capitalize")}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                    prefs.filter.priorities.includes(p) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {prefs.filter.priorities.includes(p) && <Check className="h-2.5 w-2.5" />}
                </span>
                {p}
              </DropdownMenu.CheckboxItem>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Label className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Assignee
            </DropdownMenu.Label>
            {members.map((m) => (
              <DropdownMenu.CheckboxItem
                key={m.id}
                checked={prefs.filter.assigneeIds.includes(m.id)}
                onCheckedChange={() =>
                  setFilter((f) => ({ ...f, assigneeIds: toggle(f.assigneeIds, m.id) }))
                }
                onSelect={(e) => e.preventDefault()}
                className={menuItem}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                    prefs.filter.assigneeIds.includes(m.id) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {prefs.filter.assigneeIds.includes(m.id) && <Check className="h-2.5 w-2.5" />}
                </span>
                {m.fullName}
              </DropdownMenu.CheckboxItem>
            ))}
            {filterCount > 0 && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  className={cn(menuItem, "text-muted-foreground")}
                  onSelect={() =>
                    setFilter(() => ({ search: prefs.filter.search, statusIds: [], assigneeIds: [], priorities: [] }))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <SavedViewsMenu
        savedViews={savedViews}
        saveName={saveName}
        setSaveName={setSaveName}
        onSave={() => {
          saveView(saveName);
          setSaveName("");
        }}
        onApply={applyView}
        onDelete={deleteView}
        onReset={resetPrefs}
      />
    </div>
  );
}

function SavedViewsMenu({
  savedViews,
  saveName,
  setSaveName,
  onSave,
  onApply,
  onDelete,
  onReset,
}: {
  savedViews: SavedView[];
  saveName: string;
  setSaveName: (v: string) => void;
  onSave: () => void;
  onApply: (v: SavedView) => void;
  onDelete: (name: string) => void;
  onReset: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          Views{savedViews.length ? ` (${savedViews.length})` : ""}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          {savedViews.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>
          )}
          {savedViews.map((v) => (
            <div key={v.name} className="flex items-center">
              <DropdownMenu.Item className={cn(menuItem, "flex-1")} onSelect={() => onApply(v)}>
                <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                {v.name}
              </DropdownMenu.Item>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onClick={() => onDelete(v.name)}
                className="mr-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <div className="flex items-center gap-1 px-1 py-1">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
              placeholder="Save current as…"
              className="h-7 text-xs"
            />
            <Button type="button" size="sm" className="h-7" disabled={!saveName.trim()} onClick={onSave}>
              Save
            </Button>
          </div>
          <DropdownMenu.Item className={cn(menuItem, "text-muted-foreground")} onSelect={onReset}>
            <X className="h-3.5 w-3.5" />
            Reset to default
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
