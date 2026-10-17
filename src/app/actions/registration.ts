"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  registrationSchema,
  teamFieldsSchema,
  referenceSchema,
  accessTokenSchema,
} from "@/lib/validations/registration";
import { getSettings, hasDatabase, paymentConfigured, deploymentMode } from "@/lib/config/server";
import { registrationAvailability } from "@/lib/registration/rules";
import { serviceClient } from "@/lib/supabase/service";
import { ownerRegistration, safeDatabaseError } from "@/lib/registration/data";
import { hash, tokenForSubmission, saveAccess, readAccess, rateLimit } from "@/lib/security";

export async function registerTeam(
  raw: unknown,
  submissionKey: string,
): Promise<{ error?: string; reference?: string }> {
  if (!hasDatabase() || !paymentConfigured())
    return { error: "Registration is being set up. Please check back shortly." };
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success || !z.uuid().safeParse(submissionKey).success)
    return { error: "Check the highlighted fields and try again." };
  try {
    await rateLimit("register", 20);
    const settings = await getSettings();
    const unavailable = registrationAvailability(settings);
    if (unavailable) return { error: unavailable };
    const { accepted_rules: _accepted, website: _website, ...fields } = parsed.data;
    void _accepted;
    void _website;
    const payloadHash = hash(JSON.stringify(fields));
    const token = tokenForSubmission(submissionKey, payloadHash);
    const { data, error } = await serviceClient().rpc("create_team_registration", {
      p_mode: deploymentMode(),
      p_data: fields,
      p_submission_key: submissionKey,
      p_token_hash: hash(token),
      p_payload_hash: payloadHash,
    });
    if (error) {
      console.error("Registration creation failed", { code: error.code });
      return { error: safeDatabaseError(error) };
    }
    if (!data || typeof data.reference !== "string")
      return { error: "Unable to save your registration. Please try again." };
    await saveAccess(data.reference, token);
    return { reference: data.reference };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message.startsWith("Too many")
          ? error.message
          : "Registration is temporarily unavailable. Your details have been preserved; please try again.",
    };
  }
}

export async function unlockRegistration(reference: string, token: string) {
  if (
    !hasDatabase() ||
    !referenceSchema.safeParse(reference).success ||
    !accessTokenSchema.safeParse(token).success
  )
    return { error: "This access link is invalid or has expired. Contact the organizer for help." };
  try {
    await rateLimit("access", 30, 900);
    const registration = await ownerRegistration(reference, token);
    if (!registration)
      return {
        error: "This access link is invalid or has expired. Contact the organizer for help.",
      };
    await saveAccess(reference, token);
    return { url: `/registration/${reference}` };
  } catch {
    return { error: "Unable to open this registration. Please wait a while and try again." };
  }
}

export async function correctTeam(reference: string, raw: unknown) {
  const parsed = teamFieldsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Please check the form details." };
  const row = await ownerRegistration(reference);
  if (!row) return { error: "Your private access link is required." };
  try {
    await rateLimit(`correction:${row.id}`, 15);
    const token = await readAccess(reference);
    const { error } = await serviceClient().rpc("correct_team_registration", {
      p_id: row.id,
      p_token_hash: hash(token!),
      p_data: parsed.data,
    });
    if (error) return { error: safeDatabaseError(error) };
    revalidatePath(`/registration/${reference}`);
    revalidatePath("/admin");
    return { success: "Your details have been updated. The organizer can review the corrections." };
  } catch {
    return { error: "Unable to save your corrections. Please try again shortly." };
  }
}
