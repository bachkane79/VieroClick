"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@vieroc/ui";
import { Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setAiLeaderAction } from "../project.actions";
import { AiLeaderToggle } from "./ai-leader-toggle";

interface Props {
  workspaceId: string;
  projectId: string;
  slug: string;
  aiEnabled: boolean;
}

/**
 * Banner shown at the top of the overview ONLY when AI Leader is off — a big
 * gradient call-to-action to hand the project to the AI. Hidden entirely once
 * AI Leader is on.
 */
export function AiLeaderBanner({ workspaceId, projectId, slug, aiEnabled }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (aiEnabled) return null;

  function enable() {
    start(async () => {
      const res = await setAiLeaderAction({ workspaceId, projectId, slug, enabled: true });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("AI Leader enabled — it will plan this project");
      router.refresh();
    });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-fuchsia-500/30 bg-[linear-gradient(110deg,rgba(124,58,237,0.12),rgba(217,70,239,0.12),rgba(6,182,212,0.12))] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-500">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-bold tracking-tight">Dự án đang chạy thủ công</h3>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              Bật <span className="font-semibold">AI Leader</span> để AI tự sinh kế hoạch, WBS, phân
              công và theo dõi tiến độ cho dự án này.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AiLeaderToggle checked={false} onChange={() => enable()} disabled={pending} />
          <Button type="button" className="gap-2" onClick={enable} disabled={pending}>
            <Sparkles className="h-4 w-4" />
            {pending ? "Đang bật..." : "Bật AI Leader"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Discreet settings affordance shown ONLY when AI Leader is on — a small gear
 * in the header that opens a menu to turn it off. Deliberately unobtrusive
 * (no banner) so an AI-managed project stays clean.
 */
export function AiLeaderSettingsMenu({ workspaceId, projectId, slug, aiEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!aiEnabled) return null;

  function disable() {
    start(async () => {
      const res = await setAiLeaderAction({ workspaceId, projectId, slug, enabled: false });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("AI Leader disabled — project is now manual");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Project settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-elevated"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-fuchsia-500" />
            AI Leader
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            AI đang quản lý dự án này. Tắt để chuyển sang làm thủ công (không dispatch agent).
          </p>
          <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">Đang bật</span>
            <AiLeaderToggle checked size="sm" onChange={() => disable()} disabled={pending} />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
