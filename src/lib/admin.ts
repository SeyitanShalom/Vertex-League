import "server-only";
import { z } from "zod";
export const filterSchema = z.object({
  q: z.string().trim().max(80).catch(""),
  payment: z.enum(["", "pending", "confirmed", "rejected"]).catch(""),
  status: z
    .enum(["", "submitted", "awaiting_screening", "correction_required", "approved", "rejected"])
    .catch(""),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  from: z.union([z.literal(""), z.iso.date()]).catch(""),
  to: z.union([z.literal(""), z.iso.date()]).catch(""),
});
export type AdminListRow = {
  id: string;
  registration_reference: string;
  submitted_at: string;
  registration_fee: number;
  registration_status: string;
  refund_status: string;
  team_name: string;
  manager_name: string;
  phone: string;
  payment_status: string;
};
