import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { managerIdentity } from "@/lib/auth";
import { legacyRegistrationForEmail, managerRegistrationReference } from "@/lib/registration/data";
import { ClaimTeamForm } from "@/components/registration/claim-team-form";
import { signOutManager } from "@/app/actions/manager-auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Connect your team",
  robots: { index: false, follow: false },
};
export default async function ClaimPage() {
  const identity = await managerIdentity();
  if (!identity) redirect("/manager/sign-in");
  if (await managerRegistrationReference(identity.user.id)) redirect("/team");
  if (!(await legacyRegistrationForEmail(identity.email))) redirect("/register");
  return (
    <div className="container narrow page-space">
      <ClaimTeamForm />
      <form action={signOutManager} style={{ marginTop: 16 }}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
