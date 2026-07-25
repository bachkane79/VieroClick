"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";

/** Dashboard toolbar (spec §16.2): refresh timestamp + refresh + Ask AI. */
export function DashboardToolbar({ askAiHref }: { askAiHref: string }) {
  const router = useRouter();
  const t = useTranslations();
  const format = useFormatter();
  const [refreshedAt, setRefreshedAt] = useState<string>("");
  const [spinning, setSpinning] = useState(false);

  // Client-only clock avoids a hydration mismatch on the timestamp.
  useEffect(() => {
    setRefreshedAt(format.dateTime(new Date(), "time"));
  }, [format]);

  function refresh() {
    setSpinning(true);
    router.refresh();
    setRefreshedAt(format.dateTime(new Date(), "time"));
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
      <span className="text-xs font-semibold text-muted-foreground">
        {refreshedAt && t("dashboards.refreshed", { time: refreshedAt })}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={refresh}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-xs font-semibold text-text-secondary shadow-xs transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <RefreshCw className={spinning ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {t("dashboards.refresh")}
        </button>
        <Link
          href={askAiHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("dashboards.askAi")}
        </Link>
      </div>
    </div>
  );
}
