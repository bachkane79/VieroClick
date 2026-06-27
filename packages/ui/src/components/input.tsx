import { cn } from "../utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-input placeholder:text-muted-foreground/70 flex h-9 w-full rounded-md border bg-card px-3 py-1 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
