import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabase: vi.fn(),
  rateLimit: vi.fn(),
  managerIdentity: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/config/server", () => ({
  hasDatabase: mocks.hasDatabase,
  siteUrl: () => "https://vertex-league.vercel.app",
}));
vi.mock("@/lib/security", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/auth", () => ({ managerIdentity: mocks.managerIdentity }));
vi.mock("@/lib/supabase/server", () => ({
  authClient: async () => ({ auth: mocks }),
}));

import {
  requestManagerPasswordReset,
  resendManagerConfirmation,
  signInManager,
  signUpManager,
} from "@/app/actions/manager-auth";

describe("manager confirmation emails", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.rateLimit.mockResolvedValue(undefined);
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.resend.mockResolvedValue({ error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("normalizes signup email and requests the confirmation callback", async () => {
    const result = await signUpManager({
      email: " Manager@Example.com ",
      password: "test-password",
    });

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "manager@example.com",
      password: "test-password",
      options: { emailRedirectTo: "https://vertex-league.vercel.app/auth/confirm" },
    });
    expect(result.message).toContain("Already confirmed your email?");
  });

  it("reports signup delivery failures without logging the recipient", async () => {
    mocks.signUp.mockResolvedValue({
      error: {
        code: "unexpected_failure",
        status: 500,
        message: "Error sending confirmation email to manager@example.com",
      },
    });

    const result = await signUpManager({ email: "manager@example.com", password: "test-password" });

    expect(result.error).toContain("email could not be sent");
    expect(result).not.toHaveProperty("message");
    expect(console.error).toHaveBeenCalledWith("Manager email authentication failed", {
      operation: "signup",
      code: "unexpected_failure",
      status: 500,
    });
  });

  it("recognizes Supabase email rate-limit codes", async () => {
    mocks.resend.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });

    const result = await resendManagerConfirmation("manager@example.com");

    expect(result.error).toContain("Too many email requests");
    expect(result).not.toHaveProperty("message");
  });

  it("reports an unauthorized sending address as an email delivery failure", async () => {
    mocks.resend.mockResolvedValue({
      error: { code: "email_address_not_authorized", status: 400 },
    });

    expect((await resendManagerConfirmation("manager@example.com")).error).toContain(
      "email could not be sent",
    );
  });

  it("resends signup confirmation with the shared allowance and a cooldown", async () => {
    const result = await resendManagerConfirmation(" Manager@Example.com ");

    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      1,
      "manager-signup:manager@example.com",
      5,
      3600,
    );
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      "manager-confirmation:manager@example.com",
      1,
      60,
    );
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "manager@example.com",
      options: { emailRedirectTo: "https://vertex-league.vercel.app/auth/confirm" },
    });
    expect(result.message).toContain("If this email has an account awaiting confirmation");
  });

  it("rejects an invalid email before contacting Supabase", async () => {
    expect((await resendManagerConfirmation("not-an-email")).error).toBe(
      "Enter a valid email address above.",
    );
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("blocks resend while authentication is not configured", async () => {
    mocks.hasDatabase.mockReturnValue(false);

    expect((await resendManagerConfirmation("manager@example.com")).error).toContain(
      "being set up",
    );
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it.each([1, 2])("does not send when rate-limit check %i fails", async (failedCheck) => {
    if (failedCheck === 2) mocks.rateLimit.mockResolvedValueOnce(undefined);
    mocks.rateLimit.mockRejectedValueOnce(new Error("rate limited"));

    const result = await resendManagerConfirmation("manager@example.com");

    expect(result.error).toContain("wait a minute");
    expect(result).not.toHaveProperty("message");
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("does not expose whether an email has an existing account", async () => {
    mocks.resend.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    const unknown = await resendManagerConfirmation("unknown@example.com");
    mocks.resend.mockResolvedValueOnce({
      data: { user: { email_confirmed_at: "2026-10-23" }, session: null },
      error: null,
    });
    const confirmed = await resendManagerConfirmation("confirmed@example.com");

    expect(unknown).toEqual(confirmed);
  });

  it("guides an unconfirmed account to request a new email", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed" } });

    const result = await signInManager({ email: "manager@example.com", password: "test-password" });

    expect(result.error).toContain("Resend confirmation email");
    expect(mocks.managerIdentity).not.toHaveBeenCalled();
  });

  it("does not claim a password reset was sent when the provider failed", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { status: 500, message: "Error sending recovery email" },
    });

    const result = await requestManagerPasswordReset("manager@example.com");

    expect(result.error).toContain("email could not be sent");
    expect(result).not.toHaveProperty("message");
  });
});
