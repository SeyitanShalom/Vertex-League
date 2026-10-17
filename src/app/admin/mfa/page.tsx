import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminIdentity } from "@/lib/auth";
import { MfaForm } from "@/components/admin/auth-forms";
import { signOutAdmin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Two-factor verification",
  robots: { index: false, follow: false },
};
export default async function MfaPage() {
  const identity = await adminIdentity(false);
  if (!identity) redirect("/admin/login");
  const { data: level } = await identity.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === "aal2") redirect("/admin");
  const { data } = await identity.client.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  return (
    <div className="container narrow page-space">
      <MfaForm factorId={factor?.id ?? null} />
      <form action={signOutAdmin} style={{ textAlign: "center", marginTop: 20 }}>
        <Button variant="ghost">Sign out</Button>
      </form>
    </div>
  );
}
