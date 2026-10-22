"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminActionSchema } from "@/lib/validations/registration";
import { safeDatabaseError } from "@/lib/registration/data";
import { deploymentMode } from "@/lib/config/server";
import { newAccessToken, hash, privateLink } from "@/lib/security";

export async function updateRegistration(
  raw: unknown,
): Promise<{ error?: string; success?: string; accessLink?: string }> {
  const { client } = await requireAdmin();
  const parsed = adminActionSchema.safeParse(raw);
  if (!parsed.success) return { error: "Check the action details and try again." };
  const { id, action, reason, ...details } = parsed.data;
  const { data: registration, error: lookupError } = await client
    .from("registrations")
    .select("registration_reference,manager_user_id")
    .eq("id", id)
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (lookupError || !registration)
    return { error: "This registration is not available in the current environment." };
  if (action === "recover_access" && registration.manager_user_id)
    return { error: "This team uses manager sign-in. Recover the manager account instead." };
  const token = action === "recover_access" ? newAccessToken() : null;
  const { error } = await client.rpc("admin_registration_action", {
    p_id: id,
    p_action: action,
    p_reason: reason,
    p_details: { ...details, ...(token ? { token_hash: hash(token) } : {}) },
  });
  if (error) return { error: safeDatabaseError(error) };
  revalidatePath("/admin");
  revalidatePath(`/admin/registrations/${id}`);
  revalidatePath(`/registration/${registration.registration_reference}`);
  revalidatePath(`/payment/${registration.registration_reference}`);
  return {
    success: "Registration updated.",
    ...(token ? { accessLink: privateLink(registration.registration_reference, token) } : {}),
  };
}
