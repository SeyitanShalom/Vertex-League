import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  return { requireAdmin: vi.fn(), query, from: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/config/server", () => ({ deploymentMode: () => "test" }));
vi.mock("@/lib/security", () => ({ newAccessToken: vi.fn(), hash: vi.fn(), privateLink: vi.fn() }));
vi.mock("@/lib/registration/data", () => ({
  safeDatabaseError: () => "Database rejected this action.",
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateRegistration } from "@/app/actions/admin";

const request = {
  id: "11111111-1111-4111-8111-111111111111",
  action: "request_correction",
  reason: "Correct your team location",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.select.mockReturnValue(mocks.query);
  mocks.query.eq.mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({
    data: { registration_reference: "VL-TEST-2026-000001", manager_user_id: "team-user" },
    error: null,
  });
  mocks.from.mockReturnValue(mocks.query);
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.requireAdmin.mockResolvedValue({ client: { from: mocks.from, rpc: mocks.rpc } });
});

describe("organizer correction payment verification", () => {
  it.each([undefined, false])(
    "rejects an absent or unchecked payment confirmation: %s",
    async (received) => {
      const result = await updateRegistration({
        ...request,
        correction_payment_received: received,
      });
      expect(result.error).toContain("₦2,000");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("uses the server's NGN 2,000 amount even when the caller supplies a different amount", async () => {
    const result = await updateRegistration({
      ...request,
      correction_payment_received: true,
      correction_fee_amount: 1,
    });
    expect(result.success).toBeDefined();
    expect(mocks.rpc).toHaveBeenCalledWith("admin_registration_action", {
      p_id: request.id,
      p_action: "request_correction",
      p_reason: request.reason,
      p_details: { correction_payment_received: true, correction_fee_amount: 2000 },
    });
  });

  it("requires organizer authorization before any mutation", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("not authorized"));
    await expect(
      updateRegistration({ ...request, correction_payment_received: true }),
    ).rejects.toThrow("not authorized");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not report success when the database rejects approval", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "correction_payment_required" } });
    const result = await updateRegistration({ ...request, correction_payment_received: true });
    expect(result.error).toBeDefined();
    expect(result).not.toHaveProperty("success");
  });
});
