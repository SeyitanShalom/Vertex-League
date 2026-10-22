"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { sendManagerCode, verifyManagerCode } from "@/app/actions/manager-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared";

export function ManagerSignIn({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await sendManagerCode(phone);
      if (result.error) setError(result.error);
      else if (result.phone) {
        setVerifiedPhone(result.phone);
        setCooldown(60);
      }
    } catch {
      setError("Unable to send a code right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyManagerCode(verifiedPhone, code);
      if (result.error) setError(result.error);
      if (result.url) {
        router.replace(result.url);
        router.refresh();
      }
    } catch {
      setError("Unable to verify this code right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel auth-panel stack"
      onSubmit={(event) => {
        event.preventDefault();
        void (verifiedPhone ? verify() : send());
      }}
    >
      <Phone size={28} style={{ color: "var(--accent)" }} />
      <p className="eyebrow">MANAGER SIGN-IN</p>
      <h1>{verifiedPhone ? "Enter your code." : "Your team starts here."}</h1>
      {!configured && <Notice>Manager sign-in is being set up.</Notice>}
      {verifiedPhone ? (
        <>
          <p className="small muted">Code sent to {verifiedPhone}</p>
          <label className="field">
            <span>Six-digit code</span>
            <Input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              autoFocus
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setVerifiedPhone("");
                setCode("");
                setError("");
              }}
            >
              Change number
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy || cooldown > 0}
              onClick={() => void send()}
            >
              {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </>
      ) : (
        <label className="field">
          <span>Phone number</span>
          <Input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0803 123 4567"
            autoComplete="tel"
            maxLength={24}
            required
          />
        </label>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={busy || !configured}>
        {busy ? "Please wait..." : verifiedPhone ? "Sign in" : "Send code"}
        <ArrowRight size={18} />
      </Button>
    </form>
  );
}
