import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  authClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "@/app/auth/confirm/route";

describe("email confirmation callback", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("confirms a new account and opens the team area", async () => {
    const response = await GET(
      new NextRequest("https://vertex-league.vercel.app/auth/confirm?token_hash=secret&type=email"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "secret", type: "email" });
    expect(response.headers.get("location")).toBe("https://vertex-league.vercel.app/team");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("opens the password form after recovery", async () => {
    const response = await GET(
      new NextRequest("https://vertex-league.vercel.app/auth/confirm?token_hash=secret&type=recovery"),
    );

    expect(response.headers.get("location")).toBe(
      "https://vertex-league.vercel.app/manager/reset-password",
    );
  });

  it("rejects missing, unknown, and invalid tokens", async () => {
    const missing = await GET(new NextRequest("https://vertex-league.vercel.app/auth/confirm"));
    const unknown = await GET(
      new NextRequest("https://vertex-league.vercel.app/auth/confirm?token_hash=secret&type=invite"),
    );
    verifyOtp.mockResolvedValueOnce({ error: new Error("expired") });
    const invalid = await GET(
      new NextRequest("https://vertex-league.vercel.app/auth/confirm?token_hash=expired&type=recovery"),
    );

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    for (const response of [missing, unknown, invalid]) {
      expect(response.headers.get("location")).toBe(
        "https://vertex-league.vercel.app/manager/sign-in?message=link-expired",
      );
    }
  });
});
