import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { hasDatabase } from "@/lib/config/server";
import { managerIdentity } from "@/lib/auth";
import { ManagerSignIn } from "@/components/registration/manager-sign-in";

export const metadata: Metadata = {
  title: "Team sign-in",
  robots: { index: false, follow: false },
};
export default async function ManagerSignInPage() {
  if (await managerIdentity()) redirect("/team");
  return (
    <div className="container narrow page-space">
      <Suspense><ManagerSignIn configured={hasDatabase()} /></Suspense>
    </div>
  );
}
