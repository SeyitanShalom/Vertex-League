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
        <p className="eyebrow">MANAGER ACCESS</p>
        <h1>Sign in to view your team.</h1>
        <p>Use the phone number linked to your registration.</p>
        <Button asChild>
          <Link href="/manager/sign-in">
            Sign in <ArrowUpRight size={17} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
