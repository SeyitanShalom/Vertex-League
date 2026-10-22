import type { Metadata } from "next";
import { ManagerPassword } from "@/components/registration/manager-password";
export const metadata: Metadata = {
  title: "Reset manager password",
  robots: { index: false, follow: false },
};
export default function ForgotPasswordPage() {
  return (
    <div className="container narrow page-space">
      <ManagerPassword mode="request" />
    </div>
  );
}
