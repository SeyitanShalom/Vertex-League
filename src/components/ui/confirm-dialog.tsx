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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="h3">{title}</Dialog.Title>
          <Dialog.Description className="muted">
            This change will be recorded in the registration history.
          </Dialog.Description>
          <div className="stack">{children}</div>
          <div className="button-row">
            <Dialog.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </Dialog.Cancel>
            <Button disabled={busy} onClick={onConfirm}>
              {busy ? "Saving…" : "Confirm action"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
