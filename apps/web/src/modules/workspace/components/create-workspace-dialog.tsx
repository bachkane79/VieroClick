"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { createWorkspaceAction } from "../workspace.actions";
import { Button } from "@vieroc/ui";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

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
        toast.success("Workspace created successfully!");
        onOpenChange(false);
        // Clear fields
        setName("");
        setSlug("");
        // Redirect to new workspace dashboard
        router.push(`/workspace/${res.data.slug}`);
      } else {
        toast.error(res.error ?? "Failed to create workspace");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-50 transition-opacity animate-in fade-in" />
        
        {/* Content */}
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border rounded-2xl p-6 shadow-2xl z-50 focus:outline-none animate-in zoom-in-95 slide-in-from-top-4 duration-200 border-border">
          <Dialog.Title className="text-xl font-bold tracking-tight">
            Create Workspace
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mt-1 mb-5">
            Workspaces isolate your organizations, projects, members, and event logs.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ws-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace Name
              </label>
              <input
                id="ws-name"
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Corporation"
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ws-slug" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace Slug
              </label>
              <div className="relative flex items-center">
                <input
                  id="ws-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-corp"
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background/50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm pr-20"
                />
                <span className="absolute right-3 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border">
                  viero.click/
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="rounded-xl px-4">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={submitting || !name || !slug}
                className="rounded-xl px-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/95"
              >
                {submitting ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
