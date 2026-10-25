"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRegistration } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared";

export function DeleteRegistration({
  id,
  reference,
  teamName,
  payment,
  refund,
  redirectOnSuccess = false,
}: {
  id: string;
  reference: string;
  teamName: string;
  payment: string;
  refund: string;
  redirectOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typedReference, setTypedReference] = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  function confirm() {
    if (busy || typedReference !== reference) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteRegistration({ id, reference: typedReference, confirmed: true });
        if (result.error) {
          setError(result.error);
          return;
        }
        setOpen(false);
        if (redirectOnSuccess) router.replace("/admin");
        else router.refresh();
      } catch {
        setError("Unable to delete this registration. Please try again.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="record-delete-button"
        aria-label={`Delete registration ${reference}`}
        disabled={busy}
        onClick={() => {
          setTypedReference("");
          setError("");
          setOpen(true);
        }}
      >
        <Trash2 size={16} /> Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Delete registration?"
        description={`Permanently remove ${teamName} (${reference}) from registrations. The team will need to register again to return. An audit record of the registration, payments and refunds is retained.`}
        confirmLabel="Delete registration"
        confirmDisabled={typedReference !== reference}
        destructive
        busy={busy}
        onConfirm={confirm}
      >
        {(payment === "confirmed" || refund === "pending") && (
          <Notice>
            Deleting does not refund any payment. Any outstanding refund must still be handled
            separately.
          </Notice>
        )}
        <label className="field">
          <span>Type {reference} to confirm</span>
          <Input
            value={typedReference}
            onChange={(event) => setTypedReference(event.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
      </ConfirmDialog>
    </>
  );
}
