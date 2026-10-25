"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { hasDatabase, siteUrl } from "@/lib/config/server";
import { authClient } from "@/lib/supabase/server";
import { managerIdentity } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const credentials = z.object({
  email: emailSchema,
  password: z.string().min(8).max(256),
});

function emailAuthError(
  error: { code?: string; message?: string; status?: number },
  operation: "signup" | "resend" | "reset",
) {
  const details = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase().replaceAll("_", " ");
  console.error("Manager email authentication failed", {
    operation,
    code: error.code,
    status: error.status,
  });
  if (details.includes("redirect") || details.includes("site url"))
    return "Account setup is misconfigured. Please contact the organizer.";
  if (details.includes("email signup") || details.includes("signup is disabled"))
    return "Account creation is currently disabled. Please contact the organizer.";
  if (error.status === 429 || details.includes("rate limit") || details.includes("too many"))
    return "Too many email requests. Please wait a while before requesting another link.";
  if (
    (details.includes("sending") && details.includes("email")) ||
    details.includes("smtp") ||
    details.includes("email address not authorized")
  )
    return "The email could not be sent. Please try again later or contact the organizer.";
  return operation === "signup"
    ? "Unable to create this account. Check the details and try again."
    : "Unable to send the email right now. Please try again later or contact the organizer.";
}

export async function signUpManager(input: unknown) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = credentials.safeParse(input);
  if (!parsed.success)
    return { error: "Enter a valid email and a password of at least 8 characters." };
  try {
    await rateLimit(`manager-signup:${parsed.data.email}`, 5, 3600);
    const { error } = await (
      await authClient()
    ).auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    if (error) return { error: emailAuthError(error, "signup"), retryAfterSeconds: 60 };
    return {
      retryAfterSeconds: 60,
      message:
        "If this email needs confirmation, check your inbox and spam folder for a link. Already confirmed your email? Sign in or reset your password; creating the account again will not send another confirmation.",
    };
  } catch {
    return { error: "Too many requests. Please wait a while and try again." };
  }
}

export async function resendManagerConfirmation(rawEmail: string) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Enter a valid email address above." };
  try {
    // Share the signup allowance so resending cannot bypass its email limit.
    await rateLimit(`manager-signup:${parsed.data}`, 5, 3600);
    await rateLimit(`manager-confirmation:${parsed.data}`, 1, 60);
    const { error } = await (
      await authClient()
    ).auth.resend({
      type: "signup",
      email: parsed.data,
      options: { emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    if (error) return { error: emailAuthError(error, "resend"), retryAfterSeconds: 60 };
    return {
      retryAfterSeconds: 60,
      message:
        "If this email has an account awaiting confirmation, a new link has been requested. Check your inbox and spam folder, and wait a minute before requesting another. Already confirmed? Sign in or reset your password.",
    };
  } catch {
    return {
      error: "Unable to request another link right now. Please wait a minute and try again.",
      retryAfterSeconds: 60,
    };
  }
}

export async function signInManager(input: unknown) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = credentials.safeParse(input);
  if (!parsed.success) return { error: "Enter your email and password." };
  try {
    await rateLimit(`manager-login:${parsed.data.email}`, 10, 900);
    const client = await authClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error?.code === "email_not_confirmed")
      return {
        error:
          "Confirm your email before signing in. Use Resend confirmation email below for a new link.",
      };
    if (error) return { error: "Unable to sign in. Check your email, password and confirmation." };
    if (!(await managerIdentity())) {
      await client.auth.signOut({ scope: "local" });
      return { error: "Confirm your email before signing in." };
    }
    return { url: "/team" };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
}

export async function requestManagerPasswordReset(rawEmail: string) {
  if (!hasDatabase()) return { error: "Sign-in is being set up. Please check back shortly." };
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Enter a valid email address." };
  try {
    await rateLimit(`manager-reset:${parsed.data}`, 5, 3600);
    const { error } = await (
      await authClient()
    ).auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${siteUrl()}/auth/confirm`,
    });
    if (error) return { error: emailAuthError(error, "reset") };
    return { message: "If this email has an account, a password-reset link is on its way." };
  } catch {
    return { error: "Please wait a while before requesting another link." };
  }
}

export async function updateManagerPassword(rawPassword: string) {
  if (
    !hasDatabase() ||
    typeof rawPassword !== "string" ||
    rawPassword.length < 8 ||
    rawPassword.length > 256
  )
    return { error: "Use a password of at least 8 characters." };
  try {
    const client = await authClient();
    const {
      data: { user },
      error: identityError,
    } = await client.auth.getUser();
    if (identityError || !user?.email || !user.email_confirmed_at)
      return { error: "Open the password-reset link from your email again." };
    await rateLimit(`manager-password-update:${user.id}`, 5, 900);
    const { error } = await client.auth.updateUser({ password: rawPassword });
    if (error) {
      console.error("Team password update failed", { code: error.code, status: error.status });
      if (error.code === "same_password")
        return { error: "Choose a new password that is different from your current password." };
      if (error.code === "weak_password") {
        if ("reasons" in error && Array.isArray(error.reasons) && error.reasons.includes("pwned"))
          return {
            error: "This password has appeared in a data breach. Choose a different password.",
          };
        return {
          error:
            "This password does not meet the security requirements. Choose a longer password with uppercase and lowercase letters, numbers and symbols.",
        };
      }
      if (
        [
          "reauthentication_needed",
          "reauthentication_not_valid",
          "session_not_found",
          "session_expired",
          "refresh_token_not_found",
          "bad_jwt",
        ].includes(error.code ?? "")
      )
        return {
          error: "Request a new password-reset link and open the latest email to try again.",
        };
      if (error.status === 429)
        return { error: "Too many password-change attempts. Please wait a while and try again." };
      return {
        error:
          "Unable to change your password right now. Request a new reset link or try again later.",
      };
    }
    return { url: "/team" };
  } catch {
    return { error: "Unable to change the password right now. Please try again." };
  }
}

export async function signOutManager() {
  if (hasDatabase()) await (await authClient()).auth.signOut({ scope: "local" });
  redirect("/manager/sign-in");
}
