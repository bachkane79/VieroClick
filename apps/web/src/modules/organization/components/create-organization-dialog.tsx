"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2 } from "lucide-react";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { createOrganizationAction } from "../organization.actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    const res = await createOrganizationAction({ name: name.trim() });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(actionError(res, t("organization.toast.createFailed")));
      return;
    }
    toast.success(t("organization.toast.created"));
    onOpenChange(false);
    setName("");
    router.push(`/org/${res.data.slug}/people`);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 animate-in zoom-in-95 slide-in-from-top-4 focus:outline-none">
          <Dialog.Title className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Building2 className="h-5 w-5 text-primary" />
            {t("organization.createDialog.title")}
          </Dialog.Title>
          <Dialog.Description className="mb-5 mt-1 text-sm text-muted-foreground">
            {t("organization.createDialog.description")}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="org-name"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("organization.createDialog.nameLabel")}
              </label>
              <input
                id="org-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("organization.createDialog.namePlaceholder")}
                className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm transition-all placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="rounded-xl px-4">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="rounded-xl px-4 font-semibold"
              >
                {submitting
                  ? t("organization.createDialog.submitting")
                  : t("organization.createDialog.submit")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
