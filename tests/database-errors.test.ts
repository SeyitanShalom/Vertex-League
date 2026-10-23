import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { safeDatabaseError } from "@/lib/registration/data";

describe("registration database errors", () => {
  it("identifies an existing contact number without exposing the number", () => {
    const message = safeDatabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "manager_contacts_pkey"',
    });
    expect(message).toContain("phone or WhatsApp number");
    expect(message).toContain("registration email");
  });

  it("keeps the generic response for other uniqueness conflicts", () => {
    expect(
      safeDatabaseError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "teams_mode_normalized_name_key"',
      }),
    ).toContain("team or manager already has a registration");
  });
});
