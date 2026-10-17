import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/auth-forms";
import { adminIdentity } from "@/lib/auth";
import { hasDatabase } from "@/lib/config/server";
export const metadata: Metadata = {
  title: "Organizer sign-in",
  robots: { index: false, follow: false },
};
export default async function LoginPage() {
  if (await adminIdentity()) redirect("/admin");
  return (
    <div className="container page-space">
      <LoginForm configured={hasDatabase()} />
    </div>
  );
}
