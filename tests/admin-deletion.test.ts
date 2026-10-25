import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  deploymentMode: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/config/server", () => ({ deploymentMode: mocks.deploymentMode }));
vi.mock("@/lib/security", () => ({ newAccessToken: vi.fn(), hash: vi.fn(), privateLink: vi.fn() }));
vi.mock("@/lib/registration/data", () => ({ safeDatabaseError: () => "Deletion failed." }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deleteRegistration } from "@/app/actions/admin";

const request = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "VL-2026-000001",
  confirmed: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ client: { rpc: mocks.rpc } });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.deploymentMode.mockReturnValue("live");
});

describe("registration deletion action", () => {
  it.each([undefined, false, "true"])("requires explicit confirmation: %s", async (confirmed) => {
    expect(await deleteRegistration({ ...request, confirmed })).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([{ id: "invalid" }, { reference: "" }])(
    "rejects invalid identifiers: %j",
    async (input) => {
      expect(await deleteRegistration({ ...request, ...input })).toHaveProperty("error");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("requires organizer authorization before touching the database", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(deleteRegistration(request)).rejects.toThrow("Unauthorized");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["live", "test"])(
    "uses the server's %s mode and refreshes affected pages",
    async (mode) => {
      mocks.deploymentMode.mockReturnValue(mode);
      expect(await deleteRegistration({ ...request, mode: "untrusted" })).toEqual({
        success: "Registration deleted.",
      });
      expect(mocks.rpc).toHaveBeenCalledWith("delete_registration", {
        p_id: request.id,
        p_reference: request.reference,
        p_mode: mode,
        p_confirmed: true,
      });
      for (const path of [
        "/admin",
        `/admin/registrations/${request.id}`,
        `/registration/${request.reference}`,
        `/payment/${request.reference}`,
        "/register",
      ])
        expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    },
  );

  it("reports database failures without claiming success or refreshing", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "registration_not_found" } });
    expect(await deleteRegistration(request)).toEqual({ error: "Deletion failed." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
