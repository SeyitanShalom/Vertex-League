"use client";
import * as Dialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  busy,
  description = "This change will be recorded in the registration history.",
  confirmLabel = "Confirm action",
  confirmDisabled = false,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  busy: boolean;
  description?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="h3">{title}</Dialog.Title>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          <div className="stack">{children}</div>
          <div className="button-row">
            <Dialog.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
            >
              {busy ? "Saving…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
