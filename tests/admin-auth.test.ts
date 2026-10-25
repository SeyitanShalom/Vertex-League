import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authClient: vi.fn(),
  hasDatabase: vi.fn(),
  rateLimit: vi.fn(),
  from: vi.fn(),
  query: { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() },
  auth: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ authClient: mocks.authClient }));
vi.mock("@/lib/config/server", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/lib/security", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { adminIdentity, requireAdmin } from "@/lib/auth";
import { loginAdmin, signOutAdmin } from "@/app/actions/auth";
import LegacyMfaPage from "@/app/admin/mfa/page";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "organizer@example.test",
  factors: [{ factor_type: "totp", status: "verified" }],
};
const credentials = { email: user.email, password: "example-password-123" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hasDatabase.mockReturnValue(true);
  mocks.authClient.mockResolvedValue({ auth: mocks.auth, from: mocks.from });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.signInWithPassword.mockResolvedValue({ error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
  mocks.auth.mfa.getAuthenticatorAssuranceLevel.mockRejectedValue(
    new Error("Authenticator is unavailable"),
  );
  mocks.from.mockReturnValue(mocks.query);
  mocks.query.select.mockReturnValue(mocks.query);
  mocks.query.eq.mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({ data: { user_id: user.id }, error: null });
});

describe("admin password sign-in", () => {
  it("opens the dashboard directly even when an authenticator factor already exists", async () => {
    expect(await loginAdmin(credentials)).toEqual({ url: "/admin" });
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith(credentials);
    expect(mocks.rateLimit).toHaveBeenCalledWith("admin-login", 10, 900);
    expect(mocks.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("allows an authenticated allowlisted organizer through the route guard", async () => {
    expect((await requireAdmin()).user).toEqual(user);
    expect(mocks.query.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(mocks.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("rejects valid credentials for an account outside the admin allowlist", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await loginAdmin(credentials)).toHaveProperty("error");
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });

  it("does not authorize user-editable metadata claiming admin access", async () => {
    mocks.auth.getUser.mockResolvedValue({
      data: { user: { ...user, user_metadata: { role: "admin" } } },
      error: null,
    });
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await adminIdentity()).toBeNull();
  });

  it("fails closed when membership verification fails", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });
    expect(await adminIdentity()).toBeNull();
  });

  it("rejects incorrect passwords before checking membership", async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
    expect(await loginAdmin(credentials)).toHaveProperty("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("blocks sign-in when the login rate limit is reached", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("Rate limited"));
    expect(await loginAdmin(credentials)).toHaveProperty("error");
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated visitor to sign-in", async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("redirects existing authenticator URLs directly to the dashboard", async () => {
    await expect(LegacyMfaPage()).rejects.toThrow("redirect:/admin");
    expect(mocks.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("keeps existing authenticator URLs protected for signed-out visitors", async () => {
    mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(LegacyMfaPage()).rejects.toThrow("redirect:/admin/login");
  });

  it("signs out and returns to the login page", async () => {
    await expect(signOutAdmin()).rejects.toThrow("redirect:/admin/login");
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });
});
