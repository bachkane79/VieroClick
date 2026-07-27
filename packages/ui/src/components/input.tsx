import { cn } from "../utils";

// React 19 allows `ref` as a plain prop on function components — no forwardRef,
// mirroring textarea.tsx (the ui package types React ambiently, like button.tsx).
export function Input({
  className,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={cn(
        "border-input placeholder:text-muted-foreground/70 flex h-9 w-full rounded-full border bg-card px-4 py-1 text-xs shadow-xs transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
