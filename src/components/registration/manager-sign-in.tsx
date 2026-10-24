"use client";
import { useState } from "react";
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
import { Notice } from "@/components/shared";

export function ManagerSignIn({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});
  async function resendConfirmation() {
    if (busy) return;
    setBusy(true);
    setFeedback({});
    try {
      setFeedback(await resendManagerConfirmation(email));
    } catch {
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
      <p className="eyebrow">MANAGER ACCOUNT</p>
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
      {!configured && <Notice>Manager sign-in is being set up.</Notice>}
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
      <label className="field">
        <span>Password</span>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          minLength={8}
          maxLength={256}
          required
        />
      </label>
      {mode === "create" && (
        <label className="field">
          <span>Confirm password</span>
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
      <Button type="submit" size="lg" disabled={busy || !configured}>
        {busy ? "Please wait..." : mode === "create" ? "Create account" : "Sign in"}{" "}
        <ArrowRight size={18} />
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy || !configured || !email.trim()}
        onClick={() => void resendConfirmation()}
      >
        <Mail size={16} /> Resend confirmation email
      </Button>
      {mode === "sign-in" && (
        <Link className="text-link" href="/manager/forgot-password">
          Forgot password?
        </Link>
      )}
    </form>
  );
}
