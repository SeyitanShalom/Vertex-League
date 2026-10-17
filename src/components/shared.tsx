import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-intro">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Back to the league
      </Link>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`notice notice-${tone}`}>
      <Info size={18} />
      <div>{children}</div>
    </div>
  );
}
export function AccessRequired() {
  return (
    <section className="container narrow page-space">
      <div className="empty-state">
        <ShieldCheck size={40} />
        <p className="eyebrow">Private registration</p>
        <h1>Your access link is required.</h1>
        <p>
          Open the private link you saved after registering. A registration reference alone cannot
          unlock team details.
        </p>
        <Button asChild>
          <Link href="/access">
            Open a private link <ArrowUpRight size={17} />
          </Link>
        </Button>
        <p className="small muted">
          Lost your link? Contact the organizer for identity-verified recovery.
        </p>
      </div>
    </section>
  );
}
