import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { managerIdentity } from "@/lib/auth";
import { legacyRegistrationForEmail, managerRegistrationReference } from "@/lib/registration/data";

export const metadata: Metadata = {
  title: "Your team",
  robots: { index: false, follow: false },
};
export default async function TeamPage() {
  const identity = await managerIdentity();
  if (!identity) redirect("/manager/sign-in");
  const reference = await managerRegistrationReference(identity.user.id);
  if (reference) redirect(`/registration/${reference}`);
  if (await legacyRegistrationForEmail(identity.email)) redirect("/manager/claim");
  redirect("/register");
}
