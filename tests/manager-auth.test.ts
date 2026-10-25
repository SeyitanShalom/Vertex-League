import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabase: vi.fn(),
  rateLimit: vi.fn(),
  managerIdentity: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
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
  updateManagerPassword,
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
    expect(result.retryAfterSeconds).toBe(60);
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
    expect(result.retryAfterSeconds).toBe(60);
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
    expect(result.retryAfterSeconds).toBe(60);
  });

  it("rejects an invalid email before contacting Supabase", async () => {
    expect((await resendManagerConfirmation("not-an-email")).error).toBe(
      "Enter a valid email address above.",
    );
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.resend).not.toHaveBeenCalled();
    expect(await resendManagerConfirmation("not-an-email")).not.toHaveProperty("retryAfterSeconds");
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
    expect(result.retryAfterSeconds).toBe(60);
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

describe("team password updates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.rateLimit.mockResolvedValue(undefined);
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: "team-user", email: "team@example.com", email_confirmed_at: "2026-10-25" },
      },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("updates the authenticated account and limits attempts per account", async () => {
    expect(await updateManagerPassword("new-password-123")).toEqual({ url: "/team" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    expect(mocks.rateLimit).toHaveBeenCalledWith("manager-password-update:team-user", 5, 900);
  });

  it("explains when the password matches the current password without logging it", async () => {
    mocks.updateUser.mockResolvedValue({
      error: {
        code: "same_password",
        status: 422,
        message: "Rejected password for team@example.com",
      },
    });
    const result = await updateManagerPassword("new-password-123");
    expect(result.error).toBe(
      "Choose a new password that is different from your current password.",
    );
    expect(result).not.toHaveProperty("url");
    expect(console.error).toHaveBeenCalledWith("Team password update failed", {
      code: "same_password",
      status: 422,
    });
  });

  it.each([
    { reasons: ["length"], message: "longer password" },
    { reasons: ["characters"], message: "uppercase and lowercase" },
    { reasons: ["pwned"], message: "data breach" },
  ])("explains weak-password rejection: $reasons", async ({ reasons, message }) => {
    mocks.updateUser.mockResolvedValue({ error: { code: "weak_password", status: 422, reasons } });
    expect((await updateManagerPassword("new-password-123")).error).toContain(message);
  });

  it.each(["reauthentication_needed", "session_expired", "session_not_found", "bad_jwt"])(
    "guides %s errors back to a fresh reset email",
    async (code) => {
      mocks.updateUser.mockResolvedValue({ error: { code, status: 401 } });
      expect((await updateManagerPassword("new-password-123")).error).toContain("latest email");
    },
  );

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "team-user", email: "team@example.com" } }, error: null },
    { data: { user: null }, error: { code: "session_not_found" } },
  ])("rejects missing or unconfirmed sessions before updating", async (identity) => {
    mocks.getUser.mockResolvedValue(identity);
    expect((await updateManagerPassword("new-password-123")).error).toContain(
      "link from your email",
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("reports provider rate limits without suggesting a different password", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "over_request_rate_limit", status: 429 } });
    expect((await updateManagerPassword("new-password-123")).error).toContain(
      "Too many password-change attempts",
    );
  });

  it("keeps unexpected provider details private", async () => {
    mocks.updateUser.mockResolvedValue({
      error: { code: "unexpected_failure", status: 500, message: "Private provider details" },
    });
    const result = await updateManagerPassword("new-password-123");
    expect(result.error).toContain("try again later");
    expect(result.error).not.toContain("Private provider details");
  });

  it("does not update after the application rate limit is exhausted", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("rate limited"));
    expect((await updateManagerPassword("new-password-123")).error).toContain("right now");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each(["short", "x".repeat(257)])(
    "rejects invalid password lengths before authentication",
    async (password) => {
      expect((await updateManagerPassword(password)).error).toContain("at least 8");
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(mocks.updateUser).not.toHaveBeenCalled();
    },
  );
});
