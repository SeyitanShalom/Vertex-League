import { describe, it, expect } from "vitest";
import { registrationSchema, normalizePhone } from "@/lib/validations/registration";
import { registrationAvailability, canEdit, permittedAction } from "@/lib/registration/rules";
import { whatsappLink, paymentMessage } from "@/lib/whatsapp";
import { csvCell, csv } from "@/lib/csv";
import type { OperationalSettings } from "@/types/domain";
const settings: OperationalSettings = {
  mode: "test",
  registration_fee: 100,
  registration_enabled: true,
  registration_deadline: null,
  maximum_teams: null,
  reference_prefix: "VL-TEST",
  reference_year: 2026,
};
const valid = {
  team_name: "Eagles FC",
  manager_name: "Ada Okafor",
  location: "Ikeja",
  phone: "08031234567",
  whatsapp_number: "+2348031234567",
  email: "",
  additional_information: "",
  accepted_rules: true,
  website: "",
};
describe("registration validation", () => {
  it("normalizes Nigerian numbers and optional email", () => {
    const result = registrationSchema.parse(valid);
    expect(result.phone).toBe("+2348031234567");
    expect(result.email).toBeNull();
  });
  it.each([
    { ...valid, team_name: "" },
    { ...valid, phone: "123" },
    { ...valid, accepted_rules: false },
    { ...valid, website: "spam" },
    { ...valid, email: "invalid" },
    { ...valid, additional_information: "x".repeat(1001) },
  ])("rejects invalid or abusive form data", (input) => {
    expect(registrationSchema.safeParse(input).success).toBe(false);
  });
  it("rejects international numbers when Nigerian participation is configured", () => {
    expect(normalizePhone("+14155552671")).toBeNull();
  });
});
describe("availability and edits", () => {
  it("fails closed without configuration", () =>
    expect(registrationAvailability(null)).toBeTruthy());
  it("enforces the exact deadline boundary", () => {
    expect(
      registrationAvailability(
        { ...settings, registration_deadline: "2026-10-20T22:59:59Z" },
        new Date("2026-10-20T22:59:59Z"),
      ),
    ).toContain("passed");
  });
  it("requires a live registration deadline", () =>
    expect(registrationAvailability({ ...settings, mode: "live" })).toBeTruthy());
  it("locks paid teams until corrections are explicitly requested", () => {
    expect(canEdit("awaiting_screening", null)).toBe(false);
    expect(canEdit("correction_required", "2020-01-01T00:00:00Z")).toBe(true);
    expect(canEdit("approved", null)).toBe(false);
  });
  it("does not allow approval before payment", () =>
    expect(permittedAction("approve", "pending", "submitted", "none")).toBe(false));
  it("allows a refund only for a rejected paid team with a pending refund", () => {
    expect(permittedAction("refund", "confirmed", "rejected", "pending")).toBe(true);
    expect(permittedAction("refund", "confirmed", "approved", "none")).toBe(false);
  });
});
describe("WhatsApp handoff", () => {
  it("encodes the saved reference, manager and team", () => {
    const text = paymentMessage({
      reference: "VL-TEST-2026-000001",
      team: "Eagles & Stars",
      manager: "Ada Okafor",
      fee: 100,
    });
    const link = whatsappLink("+234 803 123 4567", text)!;
    expect(link).toContain("https://wa.me/2348031234567?");
    expect(new URL(link).searchParams.get("text")).toBe(text);
    expect(text).toContain("Eagles & Stars");
  });
  it("rejects missing and malformed organizer numbers", () => {
    expect(whatsappLink("", "Hello")).toBeNull();
    expect(whatsappLink("08031234567", "Hello")).toBeNull();
  });
});
describe("CSV export", () => {
  it.each(["=SUM(A1:A2)", "+2348031234567", "  @HYPERLINK('x')", "\t=1+1", "-2+3"])(
    "neutralizes spreadsheet formulas: %s",
    (value) => {
      expect(csvCell(value)).toMatch(/^"'/);
    },
  );
  it("escapes quotes, commas and newlines", () => {
    expect(csvCell('Eagles, "FC"\nTeam')).toBe('"Eagles, ""FC""\nTeam"');
    expect(csv([["Reference", "Team"]])).toContain('"Reference","Team"');
  });
});
