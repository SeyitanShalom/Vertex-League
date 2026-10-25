"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { requestManagerPasswordReset, updateManagerPassword } from "@/app/actions/manager-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Notice } from "@/components/shared";

export function ManagerPassword({ mode }: { mode: "request" | "update" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  return (
    <form
      className="panel auth-panel stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (mode === "update" && value !== confirmation) {
          setFeedback({ error: "Passwords do not match." });
          return;
        }
        setBusy(true);
        setFeedback({});
        try {
          const result =
            mode === "request"
              ? await requestManagerPasswordReset(value)
              : await updateManagerPassword(value);
          setFeedback(result);
          if ("url" in result && result.url) {
            router.replace(result.url);
            router.refresh();
          }
        } catch {
          setFeedback({ error: "Unable to continue right now. Please try again." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <LockKeyhole size={28} style={{ color: "var(--accent)" }} />
      <p className="eyebrow">TEAM ACCOUNT</p>
      <h1>{mode === "request" ? "Reset your password." : "Choose a new password."}</h1>
      <div className="field">
        <label htmlFor="team-password-reset">
          {mode === "request" ? "Email address" : "New password"}
        </label>
        {mode === "request" ? (
          <Input
            id="team-password-reset"
            type="email"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
          />
        ) : (
          <PasswordInput
            id="team-password-reset"
            visibilityLabel="new password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required
          />
        )}
      </div>
      {mode === "update" && (
        <p className="hint">
          Use at least 8 characters and choose a password different from your current one.
        </p>
      )}
      {mode === "update" && (
        <div className="field">
          <label htmlFor="team-password-reset-confirmation">Confirm new password</label>
          <PasswordInput
            id="team-password-reset-confirmation"
            visibilityLabel="confirm new password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required
          />
        </div>
      )}
      {feedback.error && <Notice tone="error">{feedback.error}</Notice>}
      {feedback.message && <Notice tone="success">{feedback.message}</Notice>}
      <Button type="submit" disabled={busy}>
        {busy ? "Please wait..." : mode === "request" ? "Send reset link" : "Update password"}{" "}
        <ArrowRight size={17} />
      </Button>
      <Link className="text-link" href="/manager/sign-in">
        Back to sign in
      </Link>
    </form>
  );
}
