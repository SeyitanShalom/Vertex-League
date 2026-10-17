"use client";
import { useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function CopyButton({
  value,
  label = "Copy",
  errorMessage = "Copy is unavailable. Use Save access link instead.",
}: {
  value: string;
  label?: string;
  errorMessage?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setError(false);
            setTimeout(() => setCopied(false), 3000);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : label}
      </Button>
      {error && (
        <span role="alert" className="small">
          {errorMessage}
        </span>
      )}
    </>
  );
}
export function SaveAccess({ link, reference }: { link: string; reference: string }) {
  function download() {
    const blob = new Blob(
      [
        `Vertex League private registration\nReference: ${reference}\n\n${link}\n\nKeep this link private. Anyone with it can access your registration.\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reference}-private-access.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="access-save">
      <h3>Save your private registration link.</h3>
      <p>
        Keep it safe so you can return to your payment instructions and status. Share it only with
        people authorized to manage your team.
      </p>
      <div className="button-row">
        <Button size="sm" onClick={download}>
          <Download size={14} /> Save access link
        </Button>
        <CopyButton value={link} label="Copy private link" />
      </div>
    </div>
  );
}
export function RefreshStatus() {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw size={14} /> Refresh status
    </Button>
  );
}
