import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Organizer sign-in",
  robots: { index: false, follow: false },
};
export default async function MfaPage() {
  await requireAdmin();
  redirect("/admin");
}
