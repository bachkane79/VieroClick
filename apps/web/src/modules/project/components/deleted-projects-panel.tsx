"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { listDeletedProjectsAction, restoreProjectAction } from "../project.actions";

interface DeletedProject {
  id: string;
  name: string;
  deletedAt: Date | null;
}

interface Props {
  workspaceId: string;
  slug: string;
}

/** WP-D4: workspace-admin restore panel for soft-deleted projects. */
export function DeletedProjectsPanel({ workspaceId, slug }: Props) {
  const router = useRouter();
  const actionError = useActionError();
  const t = useTranslations();
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<DeletedProject[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    const result = await listDeletedProjectsAction({ workspaceId });
    if (!result.ok) {
      toast.error(actionError(result));
      return;
    }
    setItems(result.data);
    setLoaded(true);
  }

  async function restore(projectId: string) {
    setRestoringId(projectId);
    const result = await restoreProjectAction({ workspaceId, projectId, slug });
    setRestoringId(null);
    if (!result.ok) {
      toast.error(actionError(result));
      return;
    }
    toast.success(t("project.restored"));
    setItems((prev) => prev.filter((p) => p.id !== projectId));
    router.refresh();
  }

  if (!loaded) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={load}>
        {t("project.showDeleted")}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("project.noDeleted")}</p>
      )}
      {items.map((project) => (
        <div
          key={project.id}
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
        >
          <span className="truncate text-sm">{project.name}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={restoringId === project.id}
            onClick={() => restore(project.id)}
          >
            {t("project.restore")}
          </Button>
        </div>
      ))}
    </div>
  );
}
