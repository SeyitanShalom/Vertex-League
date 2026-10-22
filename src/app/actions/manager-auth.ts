"use server";
import { redirect } from "next/navigation";
import { hasDatabase } from "@/lib/config/server";
import { normalizePhone } from "@/lib/validations/registration";
import { authClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security";

export async function sendManagerCode(rawPhone: string) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone) return { error: "Enter a valid Nigerian phone number." };
  try {
    await rateLimit(`manager-code:${phone}`, 5, 3600);
    const { error } = await (await authClient()).auth.signInWithOtp({ phone });
    if (error) return { error: "A code could not be sent. Please try again shortly." };
    return { phone };
  } catch {
    return { error: "Too many requests. Please wait a while and try again." };
  }
}

export async function verifyManagerCode(rawPhone: string, rawCode: string) {
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!hasDatabase() || !phone || !/^\d{6}$/.test(code))
    return { error: "Enter the six-digit code sent to your phone." };
  try {
    await rateLimit(`manager-verify:${phone}`, 10, 900);
    const { data, error } = await (
      await authClient()
    ).auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    if (error || !data.user || data.user.phone !== phone || !data.user.phone_confirmed_at)
      return { error: "The code could not be verified. Check it and try again." };
    return { url: "/team" };
  } catch {
    return { error: "Verification is temporarily unavailable. Try again shortly." };
  }
}

export async function signOutManager() {
  if (hasDatabase()) await (await authClient()).auth.signOut({ scope: "local" });
  redirect("/manager/sign-in");
}
