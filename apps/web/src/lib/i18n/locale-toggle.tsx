"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@vieroc/ui";
import type { Locale } from "./dict";
import { setLocaleAction } from "./actions";

/** Floating VI/EN switch (prototype's language chip, promoted into the app). */
export function LocaleToggle({ locale, className }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next: Locale = locale === "vi" ? "en" : "vi";

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        await setLocaleAction(next);
        router.refresh();
        setBusy(false);
      }}
      title={next === "en" ? "Switch to English" : "Chuyển sang tiếng Việt"}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-soft",
        "transition-all duration-150 ease-out hover:-translate-y-0.5 hover:scale-105 hover:text-foreground",
        busy && "opacity-60",
        className
      )}
    >
      <Globe className="h-3.5 w-3.5" />
      {next.toUpperCase()}
    </button>
  );
}
