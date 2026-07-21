"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

/**
 * CTA for the dashboard empty state: first-time users get a direct
 * "Create workspace" button instead of having to discover the
 * workspace-selector dropdown in the sidebar (audit 1.1).
 */
export function EmptyWorkspaceCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-150 hover:bg-primary/90 active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        Create workspace
      </button>
      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
