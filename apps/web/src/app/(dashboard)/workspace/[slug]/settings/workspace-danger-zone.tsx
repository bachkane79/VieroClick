"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, Input } from "@vieroc/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { deleteWorkspaceAction } from "@/modules/workspace/workspace.actions";
import { useActionError } from "@/i18n/use-action-error";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

/** WP-D4: workspace hard-delete, owner-only (server-enforced). Requires typing
 *  the workspace name back — this is the single most destructive action in the
 *  app (cascades every project/task/member), so a plain Yes/No isn't enough. */
export function WorkspaceDangerZone({ workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();

  const canConfirm = confirmText.trim() === workspaceName;

  function handleDelete() {
    start(async () => {
      const res = await deleteWorkspaceAction({ workspaceId });
      if (!res.ok) {
        toast.error(actionError(res));
        return;
      }
      toast.success(t("settings.danger.deleted"));
      router.push("/dashboard");
    });
  }

  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">{t("settings.danger.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("settings.danger.desc")}</p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="mt-3"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
      >
        {t("settings.danger.deleteBtn")}
      </Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/45 backdrop-blur-[3px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-base font-bold tracking-tight text-foreground">
              {t("settings.danger.confirmTitle", { name: workspaceName })}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("settings.danger.confirmDesc")}
            </Dialog.Description>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspaceName}
              className="mt-3"
              autoFocus
            />
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="sm">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!canConfirm || pending}
                onClick={() => {
                  handleDelete();
                  setOpen(false);
                }}
              >
                {t("settings.danger.deleteBtn")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
