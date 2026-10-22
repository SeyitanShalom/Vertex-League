import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { managerIdentity } from "@/lib/auth";
import { ManagerPassword } from "@/components/registration/manager-password";
export const metadata: Metadata = {
  title: "New manager password",
  robots: { index: false, follow: false },
};
export default async function ResetPasswordPage() {
  if (!(await managerIdentity())) redirect("/manager/forgot-password");
  return (
    <div className="container narrow page-space">
      <ManagerPassword mode="update" />
    </div>
  );
}
