"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@vieroc/ui";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionError } from "@/i18n/use-action-error";
import { updateWorkspaceAction } from "@/modules/workspace/workspace.actions";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function GeneralSettingsForm({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const t = useTranslations();
  const actionError = useActionError();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);

  const dirty = name !== workspace.name || slug !== workspace.slug;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      const res = await updateWorkspaceAction({
        workspaceId: workspace.id,
        slug: workspace.slug,
        data: { name: name.trim(), slug: slug.trim() },
      });
      if (res.ok) {
        toast.success(t("common.changesSaved"));
        if (slug !== workspace.slug) router.push(`/workspace/${slug}/settings`);
        else router.refresh();
      } else {
        toast.error(actionError(res, t("settings.general.saveFailed")));
      }
    } catch {
      toast.error(t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("settings.general.sectionTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("settings.general.sectionSubtitle")}</p>
      </header>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">{t("settings.general.nameLabel")}</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={t("settings.general.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">{t("settings.general.slugLabel")}</Label>
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder={t("settings.general.slugPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground">
              /workspace/<span className="font-medium text-foreground">{slug || "…"}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </div>
      </form>
    </section>
  );
}
