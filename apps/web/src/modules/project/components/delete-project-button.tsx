"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { deleteProjectAction } from "../project.actions";

interface Props {
  workspaceId: string;
  projectId: string;
  slug: string;
  projectName: string;
}

/** WP-D4: soft-delete a project (manager-only, enforced server-side). Recoverable
 *  via the workspace settings "Deleted projects" panel. */
export function DeleteProjectButton({ workspaceId, projectId, slug, projectName }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteProjectAction({ workspaceId, projectId, slug });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Project deleted");
      router.push(`/workspace/${slug}/projects`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Delete project"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmationDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete project"
        description={`Delete "${projectName}"? Tasks are kept but hidden. A workspace admin can restore this later from workspace settings.`}
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </>
  );
}
