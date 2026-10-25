"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminAction, PaymentStatus, RegistrationStatus, RefundStatus } from "@/types/domain";
import { permittedAction } from "@/lib/registration/rules";
import { updateRegistration } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/shared";
import { CopyButton } from "@/components/registration/private-tools";
import { TEAM_CORRECTION_FEE } from "@/lib/registration/corrections";
import { money } from "@/lib/utils";
const labels: Record<AdminAction, string> = {
  payment_received: "Payment received",
  reject_payment: "Reject payment",
  approve: "Approve team",
  reject: "Reject registration",
  request_correction: "Approve paid corrections",
  notes: "Save internal notes",
  refund: "Record full refund",
  recover_access: "Replace private access link",
};
export function RegistrationActions({
  id,
  payment,
  status,
  refund,
  notes,
  hasManagerAccount,
  correctionApprovedAt,
}: {
  id: string;
  payment: PaymentStatus;
  status: RegistrationStatus;
  refund: RefundStatus;
  notes: string;
  hasManagerAccount: boolean;
  correctionApprovedAt: string | null;
}) {
  const [selected, setSelected] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [transfer, setTransfer] = useState("");
  const [refundDate, setRefundDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: string; accessLink?: string }>(
    {},
  );
  const [dialogError, setDialogError] = useState("");
  const router = useRouter();
  function open(action: AdminAction) {
    setSelected(action);
    setReason(action === "notes" ? notes : "");
    setChecked(false);
    setTransfer("");
    setRefundDate("");
    setDialogError("");
  }
  async function confirm() {
    if (!selected) return;
    if (
      ["payment_received", "approve", "refund", "recover_access", "request_correction"].includes(
        selected,
      ) &&
      !checked
    ) {
      setDialogError("Confirm the statement before continuing.");
      return;
    }
    if (
      ["reject_payment", "reject", "request_correction", "recover_access"].includes(selected) &&
      reason.trim().length < 3
    ) {
      setDialogError("Enter a reason before continuing.");
      return;
    }
    if (selected === "refund" && (!refundDate || transfer.trim().length < 3)) {
      setDialogError("Enter the completed refund date and transfer reference.");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const response = await updateRegistration({
        id,
        action: selected,
        reason,
        screening_passed: selected === "approve" && checked,
        ...(selected === "request_correction" ? { correction_payment_received: checked } : {}),
        ...(selected === "refund"
          ? { transfer_reference: transfer, refunded_at: new Date(refundDate).toISOString() }
          : {}),
      });
      if (response.error) {
        setDialogError(response.error);
      } else {
        setResult(response);
        setSelected(null);
        router.refresh();
      }
    } catch {
      setDialogError("Unable to update the registration. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-buttons">
        {(
          [
            "payment_received",
            "reject_payment",
            "approve",
            "reject",
            "request_correction",
            "refund",
            "notes",
            "recover_access",
          ] as AdminAction[]
        )
          .filter((action) => action !== "recover_access" || !hasManagerAccount)
          .map((action) => (
            <Button
              key={action}
              disabled={!permittedAction(action, payment, status, refund, correctionApprovedAt)}
              variant={
                action === "payment_received" || action === "approve"
                  ? "default"
                  : action === "reject" || action === "reject_payment"
                    ? "destructive"
                    : "outline"
              }
              onClick={() => open(action)}
            >
              {labels[action]}
            </Button>
          ))}
      </div>
      {result.error && <Notice tone="error">{result.error}</Notice>}
      {result.success && (
        <div style={{ marginTop: 20 }}>
          <Notice tone="success">{result.success}</Notice>
        </div>
      )}
      {result.accessLink && (
        <div className="access-save">
          <p>
            Verify the manager’s identity before sharing this replacement link. The previous link
            has been revoked.
          </p>
          <CopyButton value={result.accessLink} label="Copy replacement private link" />
          <details>
            <summary className="small">Show replacement link</summary>
            <p className="secret">{result.accessLink}</p>
          </details>
        </div>
      )}
      <ConfirmDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
        title={selected ? labels[selected] : "Update registration"}
        busy={busy}
        onConfirm={confirm}
      >
        {selected === "request_correction" && (
          <Notice>
            Verify the separate {money(TEAM_CORRECTION_FEE)} correction-fee payment before
            approving. This unlocks one correction submission; saving locks the form again. The
            instructions below will be visible to the team. Registration payment and screening
            remain separate.
          </Notice>
        )}
        {selected === "refund" && (
          <>
            <Notice>
              Record the completed bank transfer. This action records a full refund; it does not
              transfer money.
            </Notice>
            <label className="field">
              <span>Transfer reference</span>
              <Input
                value={transfer}
                onChange={(e) => setTransfer(e.target.value)}
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Refund date and time (your device’s local time)</span>
              <Input
                type="datetime-local"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="field">
          <span>
            {selected === "notes"
              ? "Internal notes"
              : selected === "request_correction"
                ? "Instructions for the team"
                : "Reason / internal note"}
          </span>
          <Textarea
            maxLength={selected === "request_correction" ? 1000 : 2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {["payment_received", "approve", "refund", "recover_access", "request_correction"].includes(
          selected ?? "",
        ) && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              {selected === "payment_received"
                ? "I checked the bank account and the full applicable fee has arrived."
                : selected === "approve"
                  ? "This team and its players attended physical screening and passed every eligibility requirement."
                  : selected === "refund"
                    ? "I have returned the full registration fee to this team, with no deductions."
                    : selected === "request_correction"
                      ? `I have verified receipt of the additional ${money(TEAM_CORRECTION_FEE)} correction fee and approve one correction submission.`
                      : "I have verified the manager’s identity. Replacing the link will revoke the previous link."}
            </span>
          </label>
        )}
        {dialogError && <Notice tone="error">{dialogError}</Notice>}
      </ConfirmDialog>
    </>
  );
}
