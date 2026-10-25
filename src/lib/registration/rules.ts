import type {
  OperationalSettings,
  PaymentStatus,
  RegistrationStatus,
  RefundStatus,
  AdminAction,
} from "@/types/domain";

export const REGISTRATION_DEADLINE_PASSED = "The registration deadline has passed.";

export function registrationAvailability(settings: OperationalSettings | null, now = new Date()) {
  if (!settings) return "Registration is being set up. Please check back shortly.";
  if (!settings.registration_enabled) return "Registration is currently closed.";
  if (settings.registration_deadline && now >= new Date(settings.registration_deadline))
    return REGISTRATION_DEADLINE_PASSED;
  if (settings.mode === "live" && !settings.registration_deadline)
    return "The organizer is finalizing the registration dates.";
  return null;
}
export function canEdit(status: RegistrationStatus, correctionApprovedAt: string | null) {
  return status === "correction_required" && !!correctionApprovedAt;
}
export function permittedAction(
  action: AdminAction,
  payment: PaymentStatus,
  registration: RegistrationStatus,
  refund: RefundStatus,
  correctionApprovedAt: string | null = null,
) {
  switch (action) {
    case "payment_received":
      return payment !== "confirmed" && registration !== "rejected" && registration !== "approved";
    case "reject_payment":
      return payment !== "confirmed" && registration !== "approved" && registration !== "rejected";
    case "approve":
      return payment === "confirmed" && refund === "none" && registration === "awaiting_screening";
    case "reject":
      return !["rejected", "approved"].includes(registration);
    case "request_correction":
      return !["rejected", "approved"].includes(registration) && !correctionApprovedAt;
    case "refund":
      return payment === "confirmed" && registration === "rejected" && refund === "pending";
    default:
      return true;
  }
}
