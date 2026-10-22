"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { hasDatabase, siteUrl } from "@/lib/config/server";
import { authClient } from "@/lib/supabase/server";
import { managerIdentity } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const credentials = z.object({
  email: emailSchema,
  password: z.string().min(8).max(256),
});

export async function signUpManager(input: unknown) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = credentials.safeParse(input);
  if (!parsed.success)
    return { error: "Enter a valid email and a password of at least 8 characters." };
  try {
    await rateLimit(`manager-signup:${parsed.data.email}`, 5, 3600);
    const { error } = await (
      await authClient()
    ).auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/team` },
    });
    if (error) return { error: "Unable to create this account. Check the details and try again." };
    return { message: "Check your email for a confirmation link to continue." };
  } catch {
    return { error: "Too many requests. Please wait a while and try again." };
  }
}

export async function signInManager(input: unknown) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return { error: "Enter your email and password." };
  try {
    await rateLimit(`manager-login:${parsed.data.email}`, 10, 900);
    const client = await authClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Unable to sign in. Check your email, password and confirmation." };
    if (!(await managerIdentity())) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Confirm your email before signing in." };
    }
    return { url: "/team" };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
}

export async function requestManagerPasswordReset(rawEmail: string) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Enter a valid email address." };
  try {
    await rateLimit(`manager-reset:${parsed.data}`, 5, 3600);
    await (
      await authClient()
    ).auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${siteUrl()}/auth/callback?next=/manager/reset-password`,
    });
    return { message: "If this email has an account, a password-reset link is on its way." };
  } catch {
    return { error: "Please wait a while before requesting another link." };
  }
}

export async function updateManagerPassword(rawPassword: string) {
  if (
    !hasDatabase() ||
    typeof rawPassword !== "string" ||
    rawPassword.length < 8 ||
    rawPassword.length > 256
  )
    return { error: "Use a password of at least 8 characters." };
  try {
    await rateLimit("manager-password-update", 5, 900);
    const client = await authClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user?.email || !user.email_confirmed_at)
      return { error: "Open the password-reset link from your email again." };
    const { error } = await client.auth.updateUser({ password: rawPassword });
    if (error) return { error: "Unable to change the password. Try another password." };
    return { url: "/team" };
  } catch {
    return { error: "Unable to change the password right now. Please try again." };
  }
}

export async function signOutManager() {
  if (hasDatabase()) await (await authClient()).auth.signOut({ scope: "local" });
  redirect("/manager/sign-in");
}
