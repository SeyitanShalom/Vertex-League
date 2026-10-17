import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { deploymentMode, hasDatabase } from "@/lib/config/server";
import { readAccess, matchesHash } from "@/lib/security";
import { referenceSchema, accessTokenSchema } from "@/lib/validations/registration";
import type { PublicRegistration, Registration } from "@/types/domain";

export const registrationColumns =
  "id,mode,team_id,registration_reference,registration_status,registration_fee,currency,submitted_at,approved_at,rejected_at,public_message,refund_status,screening_passed_at,teams(id,team_name,manager_name,phone,whatsapp_number,email,location,logo_path,additional_information),payments(id,amount,payment_status,verified_at),refunds(amount,refunded_at,transfer_reference)";
export async function ownerRegistration(
  reference: string,
  suppliedToken?: string,
): Promise<PublicRegistration | null> {
  if (!hasDatabase() || !referenceSchema.safeParse(reference).success) return null;
  const token = suppliedToken ?? (await readAccess(reference));
  if (!token || !accessTokenSchema.safeParse(token).success) return null;
  const { data, error } = await serviceClient()
    .from("registrations")
    .select(`${registrationColumns},status_token_hash`)
    .eq("registration_reference", reference)
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (error || !data || !matchesHash(token, data.status_token_hash)) return null;
  // Supabase nested-relation inference needs generated DB types; keep the cast at this boundary.
  const row = data as unknown as Registration & { status_token_hash: string };
  return {
    id: row.id,
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
  if (error.code === "23505")
    return "This team or manager already has a registration. Use your private link, or contact the organizer for recovery.";
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
    duplicate_submission:
      "This submission has already been processed. Use your existing private link.",
    reason_required: "Enter a reason for this action.",
    refund_reference_required: "Enter the completed refund’s transfer reference.",
    invalid_refund_date: "Enter a refund date after payment confirmation and no later than now.",
  };
  return (
    known[error.message || ""] ||
    "The request could not be completed. Please try again or contact the organizer."
  );
}
