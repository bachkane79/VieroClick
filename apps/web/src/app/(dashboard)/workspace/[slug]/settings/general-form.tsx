"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@vieroc/ui";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateWorkspaceAction } from "@/modules/workspace/workspace.actions";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function GeneralSettingsForm({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
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
        toast.success("Đã lưu thay đổi");
        if (slug !== workspace.slug) router.push(`/workspace/${slug}/settings`);
        else router.refresh();
      } else {
        toast.error(res.error ?? "Không lưu được");
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Thông tin chung</h2>
        <p className="text-sm text-muted-foreground">Tên hiển thị và đường dẫn của workspace.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Tên workspace</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="VD: Đội sản phẩm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">Đường dẫn (slug)</Label>
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="doi-san-pham"
            />
            <p className="text-[11px] text-muted-foreground">
              /workspace/<span className="font-medium text-foreground">{slug || "…"}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </section>
  );
}
