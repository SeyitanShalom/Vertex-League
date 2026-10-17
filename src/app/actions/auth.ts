"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { hasDatabase } from "@/lib/config/server";
import { adminIdentity } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

export async function loginAdmin(input: unknown) {
  if (!hasDatabase())
    return { error: "Connect the test Supabase project to enable administrator sign-in." };
  const parsed = z
    .object({ email: z.email(), password: z.string().min(8).max(256) })
    .safeParse(input);
  if (!parsed.success) return { error: "Enter your administrator email and password." };
  try {
    await rateLimit("admin-login", 10, 900);
    const client = await authClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Unable to sign in. Check your administrator credentials." };
    const identity = await adminIdentity(false);
    if (!identity) {
      await client.auth.signOut();
      return { error: "Unable to sign in. Check your administrator credentials." };
    }
    return { url: "/admin/mfa" };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please wait a while and try again." };
  }
}
export async function signOutAdmin() {
  if (hasDatabase()) await (await authClient()).auth.signOut();
  redirect("/admin/login");
}
export async function enrollMfa() {
  const identity = await adminIdentity(false);
  if (!identity) return { error: "Sign in with an authorized administrator account first." };
  await rateLimit(`mfa-enroll:${identity.user.id}`, 5, 900);
  const { data: list, error: listError } = await identity.client.auth.mfa.listFactors();
  if (listError || list.totp.some((f) => f.status === "verified"))
    return { error: "Use your enrolled authenticator to sign in." };
  for (const factor of list.all.filter(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  ))
    await identity.client.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await identity.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Vertex League admin",
    issuer: "Vertex League",
  });
  if (error) return { error: "Unable to set up an authenticator. Please try again." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}
export async function verifyMfa(factorId: string, code: string) {
  if (!z.uuid().safeParse(factorId).success || !/^\d{6}$/.test(code))
    return { error: "Enter the six-digit code from your authenticator." };
  const identity = await adminIdentity(false);
  if (!identity) return { error: "Please sign in again." };
  try {
    await rateLimit(`mfa-verify:${identity.user.id}`, 10, 900);
    const { error } = await identity.client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error)
      return {
        error: "The code could not be verified. Try the current code from your authenticator.",
      };
    return { url: "/admin" };
  } catch {
    return { error: "Please wait a while before trying another code." };
  }
}
