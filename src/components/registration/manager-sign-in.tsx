"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import {
  resendManagerConfirmation,
  signInManager,
  signUpManager,
} from "@/app/actions/manager-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Notice } from "@/components/shared";

const resendCooldownSeconds = 60;

export function ManagerSignIn({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(resendCooldownSeconds);
  const resendAvailableAt = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  useEffect(() => {
    resendAvailableAt.current ??= Date.now() + resendCooldownSeconds * 1000;
    const timer = window.setInterval(() => {
      setResendSeconds(
        Math.max(0, Math.ceil(((resendAvailableAt.current ?? Date.now()) - Date.now()) / 1000)),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  function startResendCooldown(seconds: number) {
    resendAvailableAt.current = Date.now() + seconds * 1000;
    setResendSeconds(seconds);
  }
  async function resendConfirmation() {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setFeedback({});
    try {
      const result = await resendManagerConfirmation(email);
      setFeedback(result);
      if ("retryAfterSeconds" in result && result.retryAfterSeconds)
        startResendCooldown(result.retryAfterSeconds);
    } catch {
      startResendCooldown(resendCooldownSeconds);
      setFeedback({ error: "Unable to request another link right now. Please try again shortly." });
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (busy) return;
    if (mode === "create" && password !== confirmation) {
      setFeedback({ error: "Passwords do not match." });
      return;
    }
    setBusy(true);
    setFeedback({});
    try {
      const result =
        mode === "create"
          ? await signUpManager({ email, password })
          : await signInManager({ email, password });
      setFeedback(result);
      if ("retryAfterSeconds" in result && result.retryAfterSeconds)
        startResendCooldown(result.retryAfterSeconds);
      if ("url" in result && result.url) {
        router.replace(result.url);
        router.refresh();
      }
    } catch {
      setFeedback({ error: "Unable to continue right now. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel auth-panel stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Mail size={28} style={{ color: "var(--accent)" }} />
      <p className="eyebrow">TEAM ACCOUNT</p>
      <h1>{mode === "create" ? "Create your account." : "Welcome back."}</h1>
      <div className="auth-mode" role="group" aria-label="Account action">
        <button
          type="button"
          aria-pressed={mode === "sign-in"}
          onClick={() => {
            setMode("sign-in");
            setFeedback({});
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "create"}
          onClick={() => {
            setMode("create");
            setFeedback({});
          }}
        >
          Create account
        </button>
      </div>
      {!configured && <Notice>Team sign-in is being set up.</Notice>}
      {params.get("message") === "link-expired" && (
        <Notice tone="error">That email link could not be used. Request a new one.</Notice>
      )}
      <label className="field">
        <span>Email address</span>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <div className="field">
        <label htmlFor="team-password">Password</label>
        <PasswordInput
          key={mode}
          id="team-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          minLength={8}
          maxLength={256}
          required
        />
      </div>
      {mode === "create" && (
        <div className="field">
          <label htmlFor="team-password-confirmation">Confirm password</label>
          <PasswordInput
            id="team-password-confirmation"
            visibilityLabel="confirm password"
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
      <Button type="submit" size="lg" disabled={busy || !configured}>
        {busy ? "Please wait..." : mode === "create" ? "Create account" : "Sign in"}{" "}
        <ArrowRight size={18} />
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy || !configured || !email.trim() || resendSeconds > 0}
        onClick={() => void resendConfirmation()}
      >
        <Mail size={16} />{" "}
        {resendSeconds > 0
          ? `Resend confirmation email in ${resendSeconds}s`
          : "Resend confirmation email"}
      </Button>
      {mode === "sign-in" && (
        <Link className="text-link" href="/manager/forgot-password">
          Forgot password?
        </Link>
      )}
    </form>
  );
}
