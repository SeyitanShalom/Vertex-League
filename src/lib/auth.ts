import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { hasDatabase } from "@/lib/config/server";

export async function managerIdentity() {
  if (!hasDatabase()) return null;
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;
  return { client, user, email: user.email.trim().toLowerCase() };
}

export async function adminIdentity() {
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
  return { client, user };
}
export async function requireAdmin() {
  const identity = await adminIdentity();
  if (!identity) redirect("/admin/login");
  return identity;
}
