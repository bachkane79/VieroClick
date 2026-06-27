import { cn } from "../utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-input placeholder:text-muted-foreground/70 flex min-h-[80px] w-full rounded-md border bg-card px-3 py-2 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
