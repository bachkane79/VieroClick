"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { buttonVariants, cn } from "@vieroc/ui";
import { useTranslations } from "next-intl";

/**
 * Segment error boundary (§12). Catches unexpected failures from project
 * pages and offers a retry — the known "no access" case is handled upstream in
 * the layout with a dedicated permission-denied surface.
 */
export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  const params = useParams() as { slug?: string };

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">{t("errors.title")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-text-secondary">
          {t("errors.body")}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => reset()} className={cn(buttonVariants())}>
            {t("errors.retry")}
          </button>
          <Link
            href={params.slug ? `/workspace/${params.slug}` : "/dashboard"}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("errors.home")}
          </Link>
        </div>
        {error.digest && <p className="mt-4 text-[11px] text-text-disabled">ref: {error.digest}</p>}
      </div>
    </div>
  );
}
