"use client";

import { useState } from "react";
import { cn } from "@vieroc/ui";
import { Sparkles } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Compact variant for tight spots (e.g. settings). */
  size?: "lg" | "sm";
}

/**
 * The headline "Sử dụng AI Leader" switch. When on, the track carries the
 * single AI classification colour (redesign §8.1) — a solid fill, no
 * multi-colour gradient competing with the primary action colour.
 */
export function AiLeaderToggle({ checked, onChange, disabled, size = "lg" }: Props) {
  const [pressed, setPressed] = useState(false);
  const big = size === "lg";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
        big ? "h-9 w-16 p-1" : "h-6 w-11 p-0.5",
        checked ? "bg-ai" : "bg-muted",
        pressed && "scale-95"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300",
          big ? "h-7 w-7" : "h-5 w-5",
          checked ? (big ? "translate-x-7" : "translate-x-5") : "translate-x-0"
        )}
      >
        <Sparkles
          className={cn(
            big ? "h-3.5 w-3.5" : "h-3 w-3",
            checked ? "text-ai" : "text-muted-foreground/50"
          )}
        />
      </span>
    </button>
  );
}
