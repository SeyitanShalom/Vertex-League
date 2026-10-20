import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { competition } from "@/lib/config/competition";

export function normalizePhone(value: string) {
  const parsed = parsePhoneNumberFromString(value, competition.country);
  if (
    !parsed?.isValid() ||
    (!competition.allowInternationalPhones && parsed.country !== competition.country)
  )
    return null;
  return parsed.number;
}
const phone = z
  .string()
  .trim()
  .max(24)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Nigerian phone number, e.g. 0803 123 4567.",
      });
      return z.NEVER;
    }
    return normalized;
  });
export const teamFieldsSchema = z.object({
  team_name: z
    .string()
    .trim()
    .min(2, "Enter your team name.")
    .max(80)
    .regex(/[a-zA-Z0-9]/, "Include letters or numbers in the team name."),
  manager_name: z.string().trim().min(3, "Enter the manager’s full name.").max(100),
  phone,
  whatsapp_number: phone,
  email: z
    .union([z.literal(""), z.email("Enter a valid email address.")])
    .nullish()
    .transform((v) => v || null),
  location: z.string().trim().min(2, "Enter your town or local government area.").max(120),
  additional_information: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
});
export const registrationSchema = teamFieldsSchema.extend({
  accepted_rules: z.literal(true, {
    error: "Please accept the registration rules and refund policy.",
  }),
  website: z.string().max(0, "Unable to submit this registration."),
});
export type RegistrationInput = z.input<typeof registrationSchema>;
export const referenceSchema = z.string().regex(/^[A-Z0-9-]{5,40}$/);
export const accessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const adminActionSchema = z.object({
  id: z.uuid(),
  action: z.enum([
    "payment_received",
    "reject_payment",
    "approve",
    "reject",
    "request_correction",
    "notes",
    "refund",
    "recover_access",
  ]),
  reason: z.string().trim().max(2000),
  screening_passed: z.boolean().optional(),
  transfer_reference: z.string().trim().max(120).optional(),
  refunded_at: z.iso.datetime().optional(),
});
