import "server-only";
import { z } from "zod";
import type { Mode, OperationalSettings } from "@/types/domain";
import { serviceClient } from "@/lib/supabase/service";

export function deploymentMode(): Mode {
  const value = process.env.COMPETITION_MODE ?? "test";
  if (value !== "test" && value !== "live")
    throw new Error("COMPETITION_MODE must be test or live.");
  return value;
}
export function hasDatabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY &&
    (process.env.STATUS_TOKEN_SECRET?.length ?? 0) >= 64,
  );
}
export function siteUrl() {
  return new URL(process.env.SITE_URL || "http://localhost:3000").origin;
}
export function operationalContact() {
  return {
    bankName: process.env.BANK_NAME?.trim() || "",
    accountName: process.env.BANK_ACCOUNT_NAME?.trim() || "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER?.trim() || "",
    whatsapp: process.env.ORGANIZER_WHATSAPP?.trim() || "",
    email: process.env.CONTACT_EMAIL?.trim() || "",
    venue: process.env.COMPETITION_VENUE?.trim() || "",
    dates: process.env.COMPETITION_DATES?.trim() || "",
    screeningVenue: process.env.SCREENING_VENUE?.trim() || "",
    screeningDate: process.env.SCREENING_DATE?.trim() || "",
  };
}
export function paymentConfigured() {
  const c = operationalContact();
  return Boolean(
    c.bankName &&
    c.accountName &&
    /^\d{10}$/.test(c.accountNumber) &&
    /^[1-9]\d{7,14}$/.test(c.whatsapp.replace(/[+\s()-]/g, "")),
  );
}
const settingsSchema = z.object({
  mode: z.enum(["test", "live"]),
  registration_fee: z.coerce.number().positive(),
  registration_enabled: z.boolean(),
  registration_deadline: z.string().nullable(),
  maximum_teams: z.number().int().positive().nullable(),
  reference_prefix: z.string(),
  reference_year: z.number(),
});
export async function getSettings(): Promise<OperationalSettings | null> {
  if (!hasDatabase()) return null;
  const { data, error } = await serviceClient()
    .from("competition_settings")
    .select("*")
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (error) {
    console.error("Competition settings unavailable", { code: error.code });
    return null;
  }
  const parsed = settingsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
