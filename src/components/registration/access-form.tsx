"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { unlockRegistration } from "@/app/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/shared";
export function AccessForm({ contactLink }: { contactLink: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  async function unlock(reference: string, key: string) {
    setBusy(true);
    setError("");
    try {
      const result = await unlockRegistration(reference, key);
      if (result.error) setError(result.error);
      if (result.url) router.replace(result.url);
    } catch {
      setError("Unable to open this registration. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const values = new URLSearchParams(window.location.hash.slice(1));
    const reference = values.get("reference");
    const key = values.get("key");
    if (reference && key) {
      window.history.replaceState(null, "", "/access");
      void unlockRegistration(reference, key)
        .then((result) => {
          if (result.error) setError(result.error);
          if (result.url) router.replace(result.url);
        })
        .catch(() => setError("Unable to open this registration. Try again shortly."));
    }
  }, [router]);
  return (
    <form
      className="panel auth-panel stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const value = new URL(field.current?.value || "");
          const parts = new URLSearchParams(value.hash.slice(1));
          void unlock(parts.get("reference") || "", parts.get("key") || "");
        } catch {
          setError("Paste the complete private link from your saved registration file.");
        }
      }}
    >
      <h2>Welcome back.</h2>
      <p className="muted small">
        Open your saved private link, or paste it below. Keep this link private.
      </p>
      <label className="field">
        <span>Private registration link</span>
        <Input
          ref={field}
          type="password"
          autoComplete="off"
          placeholder="Paste your private access link"
          required
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={busy}>
        {busy ? "Opening registration…" : "Open my registration"}
      </Button>
      <p className="hint">
        Lost your link? The organizer can verify your identity and issue a replacement.
      </p>
      {contactLink && (
        <a className="text-link" href={contactLink} target="_blank" rel="noreferrer">
          Contact the organizer ↗
        </a>
      )}
    </form>
  );
}
