"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { claimManagerRegistration } from "@/app/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared";

export function ClaimTeamForm() {
  const router = useRouter();
  const field = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="panel auth-panel stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const link = new URL(field.current?.value.trim() || "");
          const values = new URLSearchParams(link.hash.slice(1));
          const result = await claimManagerRegistration(
            values.get("reference") || "",
            values.get("key") || "",
          );
          if (result.error) setError(result.error);
          if (result.url) {
            router.replace(result.url);
            router.refresh();
          }
        } catch {
          setError("Paste the complete link you saved when you registered.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="eyebrow">EXISTING TEAM</p>
      <h1>Connect your registration.</h1>
      <p className="small muted">
        Your verified email matches an existing registration. Use its old link once to connect it
        to your account.
      </p>
      <label className="field">
        <span>Saved registration link</span>
        <Input ref={field} type="password" autoComplete="off" required />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={busy}>
        {busy ? "Connecting..." : "Connect my team"} <ArrowRight size={17} />
      </Button>
      <p className="small muted">Lost the link? Contact the organizer to verify your identity.</p>
    </form>
  );
}
