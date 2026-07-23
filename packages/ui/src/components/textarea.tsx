import { cn } from "../utils";

// React 19 allows `ref` as a plain prop on function components — no forwardRef,
// and no runtime `react` import (the ui package types React ambiently, like button.tsx).
export function Textarea({
  className,
  ref,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "border-input placeholder:text-muted-foreground/70 flex min-h-[80px] w-full rounded-2xl border bg-card px-3.5 py-2.5 text-sm shadow-xs transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
