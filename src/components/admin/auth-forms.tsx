"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { loginAdmin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Notice } from "@/components/shared";
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="panel auth-panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const result = await loginAdmin({
            email: form.get("email"),
            password: form.get("password"),
          });
          if (result.error) setError(result.error);
          if (result.url) router.push(result.url);
        } catch {
          setError("Unable to sign in. Please try again shortly.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <LockKeyhole size={25} style={{ color: "var(--accent)", marginBottom: 25 }} />
      <p className="eyebrow">ORGANIZER ACCESS</p>
      <h1>Welcome back.</h1>
      <p className="small muted">
        Sign in to manage team entries, verify payments, and record screening outcomes.
      </p>
      {!configured && (
        <Notice>
          Connect a Supabase test project and create the initial administrator to enable sign-in.
          Setup instructions are in the project README.
        </Notice>
      )}
      <label className="field">
        <span>Administrator email</span>
        <Input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <div className="field">
        <label htmlFor="admin-password">Password</label>
        <PasswordInput
          id="admin-password"
          name="password"
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={256}
        />
      </div>
      {error && (
        <div style={{ marginTop: 20 }}>
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Button type="submit" disabled={busy || !configured} style={{ width: "100%", marginTop: 25 }}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="hint" style={{ marginTop: 17 }}>
        Administrator accounts are created privately by the organizer.
      </p>
    </form>
  );
}
