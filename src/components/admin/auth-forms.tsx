"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAdmin, enrollMfa, verifyMfa } from "@/app/actions/auth";
import { authenticatorQrSource } from "@/lib/mfa";
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
        {busy ? "Signing in…" : "Continue to two-factor verification"}
      </Button>
      <p className="hint" style={{ marginTop: 17 }}>
        Administrator accounts are created privately by the organizer.
      </p>
    </form>
  );
}
export function MfaForm({ factorId }: { factorId: string | null }) {
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const result = await enrollMfa();
      if (result.error) setError(result.error);
      else if (result.factorId && result.qr && result.secret)
        setSetup({ factorId: result.factorId, qr: result.qr, secret: result.secret });
    } catch {
      setError("Authenticator setup is unavailable. Please try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-panel stack">
      <ShieldCheck size={30} style={{ color: "var(--accent)" }} />
      <h1>{factorId ? "Verify it’s you." : "Secure your admin account."}</h1>
      <p className="small muted">
        {factorId
          ? "Enter the current six-digit code from your authenticator app."
          : "Two-factor authentication is required for administrator access. Add this account to your authenticator app."}
      </p>
      {!factorId && !setup && (
        <Button onClick={enroll} disabled={busy}>
          {busy ? "Preparing…" : "Set up authenticator"}
        </Button>
      )}
      {setup && (
        <>
          <p className="small">
            Scan this code in your authenticator app, then enter its six-digit code.
          </p>
          <Image
            unoptimized
            width={200}
            height={200}
            className="qr"
            src={authenticatorQrSource(setup.qr)}
            alt="Authenticator enrollment QR code"
          />
          <details>
            <summary>Enter the setup key manually</summary>
            <p className="secret">{setup.secret}</p>
          </details>
        </>
      )}
      {(factorId || setup) && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const code = String(new FormData(e.currentTarget).get("code") || "");
            try {
              const result = await verifyMfa(factorId || setup!.factorId, code);
              if (result.error) setError(result.error);
              if (result.url) {
                router.push(result.url);
                router.refresh();
              }
            } catch {
              setError("Unable to verify the code. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>Authenticator code</span>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="000000"
            />
          </label>
          <Button disabled={busy} type="submit">
            {busy ? "Verifying…" : "Verify & open dashboard"}
          </Button>
        </form>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
