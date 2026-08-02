import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@vieroc/ui";

/**
 * Browser-chrome frame around a product mock.
 *
 * These mocks are reproductions of the real app UI, not live data. When the
 * frame is purely illustrative it is `aria-hidden`, so a screen reader gets
 * the surrounding section copy instead of a stream of fake task titles. Pass
 * `decorative={false}` when the frame holds interactive markup — a tab panel
 * must stay in the accessibility tree for the tabs controlling it to mean
 * anything.
 */
export function AppChrome({
  children,
  url,
  decorative = true,
  className,
}: {
  children: ReactNode;
  url?: string;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden={decorative || undefined}
      className={cn(
        "overflow-hidden rounded-shell border border-border bg-surface",
        className
      )}
    >
      <div className="flex h-11 items-center gap-2 border-b border-border bg-surface-subtle px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        {url ? (
          <span className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-2xs text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            {url}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Soft-tinted square icon plate used across the mocks and feature cards. */
export function IconPlate({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "mint" | "peach" | "sky" | "lavender";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-soft text-primary",
    mint: "bg-mint-soft text-mint",
    peach: "bg-peach-soft text-peach",
    sky: "bg-sky-soft text-sky",
    lavender: "bg-lavender-soft text-lavender",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Overlapping initial-letter avatars. Deterministic tint per index. */
export function AvatarStack({ names, className }: { names: string[]; className?: string }) {
  const tints = [
    "bg-sky-soft text-sky",
    "bg-mint-soft text-mint",
    "bg-peach-soft text-peach",
    "bg-lavender-soft text-lavender",
    "bg-brand-soft text-primary",
  ];
  return (
    <span className={cn("flex -space-x-2", className)}>
      {names.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold ring-2 ring-surface",
            tints[i % tints.length]
          )}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

/** The signature orange→amber→green fill. Progress and goal bars only. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-surface-hover", className)}>
      <span className="block h-full rounded-full bg-tone-progress" style={{ width: `${value}%` }} />
    </span>
  );
}
