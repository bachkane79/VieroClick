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
 * The headline "Sử dụng AI Leader" switch: a large gradient toggle with a
 * press/bounce animation. When on, the track shows an animated gradient + glow.
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
        checked
          ? "bg-[linear-gradient(110deg,#7c3aed,#d946ef,#06b6d4)] bg-[length:200%_100%] shadow-[0_0_18px_rgba(217,70,239,0.55)] animate-[aileader-pan_3s_linear_infinite]"
          : "bg-muted",
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
            checked ? "text-fuchsia-500" : "text-muted-foreground/50"
          )}
        />
      </span>
      {/* keyframes for the gradient pan */}
      <style>{`@keyframes aileader-pan{0%{background-position:0% 50%}100%{background-position:200% 50%}}`}</style>
    </button>
  );
}
