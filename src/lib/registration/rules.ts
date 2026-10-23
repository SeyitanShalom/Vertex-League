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
export function canEdit(status: RegistrationStatus, deadline: string | null, now = new Date()) {
  return (
    status === "correction_required" ||
    (status === "submitted" && (!deadline || now < new Date(deadline)))
  );
}
export function permittedAction(
  action: AdminAction,
  payment: PaymentStatus,
  registration: RegistrationStatus,
  refund: RefundStatus,
) {
  switch (action) {
    case "payment_received":
      return payment !== "confirmed" && registration !== "rejected" && registration !== "approved";
    case "reject_payment":
      return payment !== "confirmed" && registration !== "approved" && registration !== "rejected";
    case "approve":
      return (
        payment === "confirmed" &&
        refund === "none" &&
        ["awaiting_screening", "correction_required"].includes(registration)
      );
    case "reject":
      return !["rejected", "approved"].includes(registration);
    case "request_correction":
      return !["rejected", "approved"].includes(registration);
    case "refund":
      return payment === "confirmed" && registration === "rejected" && refund === "pending";
    default:
      return true;
  }
}
