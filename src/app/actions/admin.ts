"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { adminActionSchema, referenceSchema } from "@/lib/validations/registration";
import { safeDatabaseError } from "@/lib/registration/data";
import { deploymentMode } from "@/lib/config/server";
import { newAccessToken, hash, privateLink } from "@/lib/security";
import { TEAM_CORRECTION_FEE } from "@/lib/registration/corrections";

export async function updateRegistration(
  raw: unknown,
): Promise<{ error?: string; success?: string; accessLink?: string }> {
  const { client } = await requireAdmin();
  const parsed = adminActionSchema.safeParse(raw);
  if (!parsed.success) return { error: "Check the action details and try again." };
  const { id, action, reason, ...details } = parsed.data;
  if (action === "request_correction" && details.correction_payment_received !== true)
    return {
      error: "Confirm receipt of the additional ₦2,000 correction fee before approving edits.",
    };
  const { data: registration, error: lookupError } = await client
    .from("registrations")
    .select("registration_reference,manager_user_id")
    .eq("id", id)
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (lookupError || !registration)
    return { error: "This registration is not available in the current environment." };
  if (action === "recover_access" && registration.manager_user_id)
    return { error: "This team uses team sign-in. Recover the team account instead." };
  const token = action === "recover_access" ? newAccessToken() : null;
  const { error } = await client.rpc("admin_registration_action", {
    p_id: id,
    p_action: action,
    p_reason: reason,
    p_details: {
      ...details,
      ...(action === "request_correction" ? { correction_fee_amount: TEAM_CORRECTION_FEE } : {}),
      ...(token ? { token_hash: hash(token) } : {}),
    },
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

const deleteTestSchema = z.object({
  id: z.uuid(),
  reference: referenceSchema,
  verifiedNoPayment: z.literal(true),
});

export async function deleteTestRegistration(raw: unknown) {
  const { client } = await requireAdmin();
  if (deploymentMode() !== "test") return { error: "Only test registrations can be deleted." };
  const parsed = deleteTestSchema.safeParse(raw);
  if (!parsed.success)
    return { error: "Enter the exact reference and confirm no payment was received." };
  const { error } = await client.rpc("delete_test_registration", {
    p_id: parsed.data.id,
    p_reference: parsed.data.reference,
  });
  if (error) return { error: safeDatabaseError(error) };
  revalidatePath("/admin");
  revalidatePath(`/admin/registrations/${parsed.data.id}`);
  return { success: "Test registration deleted." };
}

const deleteRegistrationSchema = z.object({
  id: z.uuid(),
  reference: referenceSchema,
  confirmed: z.literal(true),
});

export async function deleteRegistration(raw: unknown) {
  const { client } = await requireAdmin();
  const parsed = deleteRegistrationSchema.safeParse(raw);
  if (!parsed.success)
    return { error: "Enter the exact registration reference to confirm deletion." };
  const { id, reference, confirmed } = parsed.data;
  const { error } = await client.rpc("delete_registration", {
    p_id: id,
    p_reference: reference,
    p_mode: deploymentMode(),
    p_confirmed: confirmed,
  });
  if (error) return { error: safeDatabaseError(error) };
  revalidatePath("/admin");
  revalidatePath(`/admin/registrations/${id}`);
  revalidatePath(`/registration/${reference}`);
  revalidatePath(`/payment/${reference}`);
  revalidatePath("/register");
  return { success: "Registration deleted." };
}
