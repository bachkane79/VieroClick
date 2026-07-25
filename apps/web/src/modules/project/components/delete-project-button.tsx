"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useActionError } from "@/i18n/use-action-error";
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
  const actionError = useActionError();
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteProjectAction({ workspaceId, projectId, slug });
      if (!res.ok) {
        toast.error(actionError(res));
        return;
      }
      toast.success(t("project.deleted"));
      router.push(`/workspace/${slug}/projects`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("project.deleteTitle")}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmationDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("project.deleteTitle")}
        description={t("project.deleteConfirm", { name: projectName })}
        variant="destructive"
        confirmLabel={t("common.delete")}
        onConfirm={handleDelete}
      />
    </>
  );
}
