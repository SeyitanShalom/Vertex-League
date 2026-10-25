export type Mode = "test" | "live";
export type PaymentStatus = "pending" | "confirmed" | "rejected";
export type RegistrationStatus =
  "submitted" | "awaiting_screening" | "correction_required" | "approved" | "rejected";
export type RefundStatus = "none" | "pending" | "refunded";
export interface OperationalSettings {
  mode: Mode;
  registration_fee: string | number;
  registration_enabled: boolean;
  registration_deadline: string | null;
  maximum_teams: number | null;
  reference_prefix: string;
  reference_year: number;
}
export interface Team {
  id: string;
  team_name: string;
  manager_name: string;
  phone: string;
  whatsapp_number: string;
  email: string | null;
  location: string;
  logo_path: string | null;
  additional_information: string | null;
}
export interface Registration {
  id: string;
  manager_user_id?: string | null;
  mode: Mode;
  team_id: string;
  registration_reference: string;
  registration_status: RegistrationStatus;
  correction_approved_at: string | null;
  registration_fee: number | string;
  currency: string;
  submitted_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  admin_notes: string;
  public_message: string | null;
  refund_status: RefundStatus;
  screening_passed_at: string | null;
  teams: Team;
  payments: {
    id: string;
    amount: number | string;
    payment_status: PaymentStatus;
    verified_at: string | null;
  }[];
  refunds: { amount: number | string; refunded_at: string; transfer_reference: string } | null;
}
export type PublicRegistration = Omit<Registration, "admin_notes"> & {
  accessMode: "manager" | "legacy";
};
export type AdminAction =
  | "payment_received"
  | "reject_payment"
  | "approve"
  | "reject"
  | "request_correction"
  | "notes"
  | "refund"
  | "recover_access";
export interface ActionResult {
  error?: string;
  success?: string;
}
