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
    const identity = await adminIdentity();
    if (!identity) {
      await client.auth.signOut();
      return { error: "Unable to sign in. Check your administrator credentials." };
    }
    return { url: "/admin" };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please wait a while and try again." };
  }
}
export async function signOutAdmin() {
  if (hasDatabase()) await (await authClient()).auth.signOut();
  redirect("/admin/login");
}
