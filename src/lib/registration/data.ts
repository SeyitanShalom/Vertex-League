import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { deploymentMode, hasDatabase } from "@/lib/config/server";
import { readAccess, matchesHash } from "@/lib/security";
import { referenceSchema, accessTokenSchema } from "@/lib/validations/registration";
import { managerIdentity } from "@/lib/auth";
import type { PublicRegistration, Registration } from "@/types/domain";

export const registrationColumns =
  "id,mode,team_id,manager_user_id,registration_reference,registration_status,registration_fee,currency,submitted_at,approved_at,rejected_at,public_message,refund_status,screening_passed_at,teams(id,team_name,manager_name,phone,whatsapp_number,email,location,logo_path,additional_information),payments(id,amount,payment_status,verified_at),refunds(amount,refunded_at,transfer_reference)";
export async function managerRegistrationReference(userId: string) {
  if (!hasDatabase()) return null;
  const { data, error } = await serviceClient()
    .from("registrations")
    .select("registration_reference")
    .eq("mode", deploymentMode())
    .eq("manager_user_id", userId)
    .maybeSingle();
  return error ? null : (data?.registration_reference ?? null);
}
export async function legacyRegistrationForEmail(email: string) {
  if (!hasDatabase()) return false;
  const { data, error } = await serviceClient()
    .from("registrations")
    .select("id,teams!inner(email)")
    .eq("mode", deploymentMode())
    .is("manager_user_id", null)
    .ilike("teams.email", email.replaceAll("%", "\\%").replaceAll("_", "\\_"))
    .limit(1)
    .maybeSingle();
  return !error && !!data;
}
export async function ownerRegistration(
  reference: string,
  suppliedToken?: string,
): Promise<PublicRegistration | null> {
  if (!hasDatabase() || !referenceSchema.safeParse(reference).success) return null;
  const { data, error } = await serviceClient()
    .from("registrations")
    .select(`${registrationColumns},status_token_hash`)
    .eq("registration_reference", reference)
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (error || !data) return null;
  if (data.manager_user_id) {
    const identity = await managerIdentity();
    if (!identity || identity.user.id !== data.manager_user_id) return null;
  } else {
    const token = suppliedToken ?? (await readAccess(reference));
    if (
      !token ||
      !accessTokenSchema.safeParse(token).success ||
      !matchesHash(token, data.status_token_hash)
    )
      return null;
  }
  // Supabase nested-relation inference needs generated DB types; keep the cast at this boundary.
  const row = data as unknown as Registration & { status_token_hash: string };
  return {
    id: row.id,
    accessMode: data.manager_user_id ? "manager" : "legacy",
    mode: row.mode,
    team_id: row.team_id,
    registration_reference: row.registration_reference,
    registration_status: row.registration_status,
    registration_fee: row.registration_fee,
    currency: row.currency,
    submitted_at: row.submitted_at,
    approved_at: row.approved_at,
    rejected_at: row.rejected_at,
    public_message: row.public_message,
    refund_status: row.refund_status,
    screening_passed_at: row.screening_passed_at,
    teams: row.teams,
    payments: row.payments,
    refunds: row.refunds,
  };
}
export function safeDatabaseError(error: { code?: string; message?: string }) {
  if (error.code === "23505" && error.message?.includes('"manager_contacts_pkey"'))
    return "A phone or WhatsApp number is already linked to a registration. If this is your team, sign in with its registration email to claim it, or contact the organizer to verify ownership.";
  if (error.code === "23505")
    return "This team or manager already has a registration. Sign in to your existing team or contact the organizer.";
  const known: Record<string, string> = {
    registration_closed: "Registration is currently closed.",
    deadline_passed: "The registration deadline has passed.",
    capacity_reached:
      "All available places are currently booked. Please contact the organizer before paying.",
    editing_locked: "Editing is locked. Please ask the organizer to enable corrections.",
    screening_and_payment_required:
      "Confirm payment and physical screening before approving the team.",
    screening_after_deadline:
      "Final approval is available after the registration deadline and physical screening.",
    invalid_transition:
      "This action is not available for the current status. Refresh and check the record.",
    duplicate_submission: "This submission has already been processed. Open your team page.",
    already_registered: "Your account already has a team. Open your team page.",
    registration_not_found: "This registration is no longer available. Refresh the page.",
    test_deletion_not_allowed:
      "This test registration has payment, review, or badge history and cannot be deleted.",
    access_denied: "This registration could not be linked to your account. Contact the organizer.",
    reason_required: "Enter a reason for this action.",
    refund_reference_required: "Enter the completed refund’s transfer reference.",
    invalid_refund_date: "Enter a refund date after payment confirmation and no later than now.",
  };
  return (
    known[error.message || ""] ||
    "The request could not be completed. Please try again or contact the organizer."
  );
}
