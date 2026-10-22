"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { requestManagerPasswordReset, updateManagerPassword } from "@/app/actions/manager-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <p className="eyebrow">MANAGER ACCOUNT</p>
      <h1>{mode === "request" ? "Reset your password." : "Choose a new password."}</h1>
      <label className="field">
        <span>{mode === "request" ? "Email address" : "New password"}</span>
        <Input
          type={mode === "request" ? "email" : "password"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete={mode === "request" ? "email" : "new-password"}
          minLength={mode === "update" ? 8 : undefined}
          maxLength={mode === "request" ? 254 : 256}
          required
        />
      </label>
      {mode === "update" && (
        <label className="field">
          <span>Confirm new password</span>
          <Input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required
          />
        </label>
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
