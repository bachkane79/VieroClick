"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { createWorkspaceAction } from "../workspace.actions";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();

  // Helper to auto-slugify name
  const handleNameChange = (val: string) => {
    setName(val);
    // Convert to lowercase, replace non-alphanumeric with hyphen, remove trailing/leading hyphens
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setSubmitting(true);

    try {
      const res = await createWorkspaceAction({ name, slug });
      if (res.ok) {
        toast.success(t("workspaceCreate.created"));
        onOpenChange(false);
        // Clear fields
        setName("");
        setSlug("");
        // Redirect to new workspace dashboard
        router.push(`/workspace/${res.data.slug}`);
      } else {
        toast.error(actionError(res, t("workspaceCreate.createFailed")));
      }
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-sm transition-opacity animate-in fade-in" />

        {/* Content */}
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200 animate-in zoom-in-95 slide-in-from-top-4 focus:outline-none">
          <Dialog.Title className="text-xl font-bold tracking-tight">
            {t("workspaceCreate.title")}
          </Dialog.Title>
          <Dialog.Description className="mb-5 mt-1 text-sm text-muted-foreground">
            {t("workspaceCreate.description")}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="ws-name"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("workspaceCreate.nameLabel")}
              </label>
              <input
                id="ws-name"
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("workspaceCreate.namePlaceholder")}
                className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ws-slug"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("workspaceCreate.slugLabel")}
              </label>
              <div className="relative flex items-center">
                <input
                  id="ws-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t("workspaceCreate.slugPlaceholder")}
                  className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2 pr-20 text-sm placeholder-neutral-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="absolute right-3 rounded border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  viero.click/
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="rounded-xl px-4">
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={submitting || !name || !slug}
                className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/95"
              >
                {submitting ? t("workspaceCreate.creating") : t("workspaceCreate.submit")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
