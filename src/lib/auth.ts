import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { hasDatabase } from "@/lib/config/server";
import { normalizePhone } from "@/lib/validations/registration";

export async function managerIdentity() {
  if (!hasDatabase()) return null;
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.phone || !user.phone_confirmed_at) return null;
  const phone = normalizePhone(user.phone);
  if (!phone) return null;
  return { client, user, phone };
}

export async function adminIdentity(requireMfa = true) {
  if (!hasDatabase()) return null;
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: member, error: memberError } = await client
    .from("admin_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError || !member) return null;
  if (requireMfa) {
    const { data: level, error: mfaError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaError || level?.currentLevel !== "aal2") return null;
  }
  return { client, user };
}
export async function requireAdmin() {
  const identity = await adminIdentity(false);
  if (!identity) redirect("/admin/login");
  const { data, error } = await identity.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data?.currentLevel !== "aal2") redirect("/admin/mfa");
  return identity;
}
