"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTestRegistration } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared";

export function DeleteTestRegistration({
  id,
  reference,
  mode,
  payment,
  status,
  refund,
  redirectOnSuccess = false,
}: {
  id: string;
  reference: string;
  mode: string;
  payment: string;
  status: string;
  refund: string;
  redirectOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typedReference, setTypedReference] = useState("");
  const [verifiedNoPayment, setVerifiedNoPayment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (mode !== "test") return null;

  const eligible = payment === "pending" && status === "submitted" && refund === "none";

  async function confirm() {
    if (busy || typedReference !== reference || !verifiedNoPayment) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteTestRegistration({
        id,
        reference: typedReference,
        verifiedNoPayment,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectOnSuccess) router.replace("/admin");
      else router.refresh();
    } catch {
      setError("Unable to delete this test registration. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <span
        title={eligible ? `Delete test registration ${reference}` : "Only untouched, unpaid test registrations can be deleted"}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="record-delete-button"
          aria-label={`Delete test registration ${reference}`}
          disabled={!eligible}
          onClick={() => {
            setTypedReference("");
            setVerifiedNoPayment(false);
            setError("");
            setOpen(true);
          }}
        >
          <Trash2 size={16} />
        </Button>
      </span>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Delete test registration"
        description="This permanently removes the test team, its contact numbers, pending payment entry and submission history. It cannot be undone."
        confirmLabel="Delete registration"
        confirmDisabled={typedReference !== reference || !verifiedNoPayment}
        destructive
        busy={busy}
        onConfirm={() => void confirm()}
      >
        <label className="field">
          <span>Type {reference} to confirm</span>
          <Input
            value={typedReference}
            onChange={(event) => setTypedReference(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={verifiedNoPayment}
            onChange={(event) => setVerifiedNoPayment(event.target.checked)}
          />
          <span>I checked the bank account and no payment was received for this team.</span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
      </ConfirmDialog>
    </>
  );
}
