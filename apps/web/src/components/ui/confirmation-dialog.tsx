import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@vieroc/ui";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
}

export function ConfirmationDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
}: ConfirmationDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] z-50 transition-opacity animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border rounded-2xl p-5 shadow-2xl z-50 focus:outline-none animate-in zoom-in-95 slide-in-from-top-4 duration-200 border-neutral-200/50 dark:border-neutral-800/50 bg-background">
          <Dialog.Title className="text-base font-bold tracking-tight text-foreground">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground mt-2 mb-6 leading-relaxed">
            {description}
          </Dialog.Description>
          <div className="flex items-center justify-end gap-2.5">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm" className="text-xs font-medium">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              size="sm"
              className="text-xs font-semibold px-4"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
