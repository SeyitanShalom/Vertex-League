"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  registrationSchema,
  teamFieldsSchema,
  referenceSchema,
  accessTokenSchema,
  registrationDraftSchema,
} from "@/lib/validations/registration";
import { getSettings, hasDatabase, paymentConfigured, deploymentMode } from "@/lib/config/server";
import { registrationAvailability } from "@/lib/registration/rules";
import { serviceClient } from "@/lib/supabase/service";
import {
  ownerRegistration,
  safeDatabaseError,
  managerRegistrationReference,
} from "@/lib/registration/data";
import { managerIdentity } from "@/lib/auth";
import {
  hash,
  tokenForSubmission,
  newAccessToken,
  saveAccess,
  readAccess,
  rateLimit,
} from "@/lib/security";

export async function registerTeam(
  raw: unknown,
  submissionKey: string,
): Promise<{ error?: string; reference?: string }> {
  if (!hasDatabase() || !paymentConfigured())
    return { error: "Registration is being set up. Please check back shortly." };
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success || !z.uuid().safeParse(submissionKey).success)
    return { error: "Check the highlighted fields and try again." };
  const identity = await managerIdentity();
  if (!identity) return { error: "Sign in with your phone before registering a team." };
  try {
    await rateLimit("register", 20);
    const settings = await getSettings();
    const unavailable = registrationAvailability(settings);
    if (unavailable) return { error: unavailable };
    const { accepted_rules: _accepted, website: _website, ...fields } = parsed.data;
    void _accepted;
    void _website;
    fields.phone = identity.phone;
    const payloadHash = hash(JSON.stringify(fields));
    const token = tokenForSubmission(submissionKey, payloadHash);
    const { data, error } = await serviceClient().rpc("create_manager_registration", {
      p_mode: deploymentMode(),
      p_data: fields,
      p_submission_key: submissionKey,
      p_token_hash: hash(token),
      p_payload_hash: payloadHash,
      p_manager_user_id: identity.user.id,
    });
    if (error) {
      console.error("Registration creation failed", { code: error.code });
      return { error: safeDatabaseError(error) };
    }
    if (!data || typeof data.reference !== "string")
      return { error: "Unable to save your registration. Please try again." };
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

export async function saveManagerDraft(raw: unknown) {
  const parsed = registrationDraftSchema.safeParse(raw);
  if (!parsed.success) return { error: "Unable to save this draft. Check the field lengths." };
  const identity = await managerIdentity();
  if (!identity) return { error: "Sign in again to save your progress." };
  try {
    await rateLimit(`manager-draft:${identity.user.id}`, 30, 3600);
  } catch {
    return { error: "Please wait a while before saving again." };
  }
  if (await managerRegistrationReference(identity.user.id))
    return { error: "Your team is already registered. Open your team page." };
  const { error } = await serviceClient().rpc("save_manager_draft", {
    p_mode: deploymentMode(),
    p_user_id: identity.user.id,
    p_data: parsed.data,
  });
  return error
    ? { error: "Unable to save your progress right now." }
    : { success: "Progress saved." };
}

export async function claimManagerRegistration(reference: string, token: string) {
  const identity = await managerIdentity();
  if (!identity) return { error: "Sign in with your phone first." };
  if (await managerRegistrationReference(identity.user.id))
    return { error: "Your account already has a team." };
  if (!referenceSchema.safeParse(reference).success || !accessTokenSchema.safeParse(token).success)
    return { error: "Paste the complete registration link." };
  try {
    await rateLimit(`claim:${identity.user.id}`, 10, 900);
    const row = await ownerRegistration(reference, token);
    if (!row || row.accessMode !== "legacy" || row.teams.phone !== identity.phone)
      return { error: "This link and signed-in phone do not match. Contact the organizer." };
    const { error } = await serviceClient().rpc("claim_manager_registration", {
      p_id: row.id,
      p_token_hash: hash(token),
      p_manager_user_id: identity.user.id,
      p_revoked_token_hash: hash(newAccessToken()),
    });
    if (error) return { error: safeDatabaseError(error) };
    revalidatePath(`/registration/${reference}`);
    return { url: "/team" };
  } catch {
    return { error: "Unable to link this team right now. Please try again." };
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
    if (!registration || registration.accessMode !== "legacy")
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
  if (!row) return { error: "Sign in to access this team." };
  try {
    await rateLimit(`correction:${row.id}`, 15);
    const identity = row.accessMode === "manager" ? await managerIdentity() : null;
    if (row.accessMode === "manager" && !identity)
      return { error: "Sign in again to save corrections." };
    const token = row.accessMode === "legacy" ? await readAccess(reference) : null;
    const { error } =
      row.accessMode === "manager"
        ? await serviceClient().rpc("correct_manager_registration", {
            p_id: row.id,
            p_manager_user_id: identity!.user.id,
            p_data: { ...parsed.data, phone: identity!.phone },
          })
        : await serviceClient().rpc("correct_team_registration", {
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
