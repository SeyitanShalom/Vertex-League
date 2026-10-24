import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { proxy } from "@/proxy";

describe("confirmation links sent to the homepage", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["email", "recovery"])(
    "forwards a %s token to the same-origin verifier",
    async (type) => {
      const response = await proxy(
        new NextRequest(`https://vertexleague.com.ng/?token_hash=example-token&type=${type}`),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `https://vertexleague.com.ng/auth/confirm?token_hash=example-token&type=${type}`,
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      // The redirect does not confirm an account or issue a session itself.
      expect(createServerClient).not.toHaveBeenCalled();
      expect(response.cookies.getAll()).toEqual([]);
    },
  );

  it("discards supplied destinations and tracking fields", async () => {
    const response = await proxy(
      new NextRequest(
        "https://vertexleague.com.ng/?token_hash=example-token&type=email&next=https://other.example&redirect_to=//other.example&utm_source=email",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://vertexleague.com.ng/auth/confirm?token_hash=example-token&type=email",
    );
  });

  it.each([
    "/",
    "/?utm_source=email",
    "/?type=email",
    "/?token_hash=&type=email",
    "/?token_hash=example-token&type=invite",
    "/?token_hash=example-token",
  ])("leaves normal or unsupported homepage requests alone: %s", async (path) => {
    const response = await proxy(new NextRequest(`https://vertexleague.com.ng${path}`));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("does not redirect another public page carrying the same query fields", async () => {
    const response = await proxy(
      new NextRequest("https://vertexleague.com.ng/access?token_hash=example-token&type=email"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
