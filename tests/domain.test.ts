import { describe, it, expect } from "vitest";
import {
  registrationSchema,
  teamFieldsSchema,
  normalizePhone,
} from "@/lib/validations/registration";
import { registrationAvailability, canEdit, permittedAction } from "@/lib/registration/rules";
import { whatsappLink, paymentMessage } from "@/lib/whatsapp";
import { csvCell, csv } from "@/lib/csv";
import { authenticatorQrSource } from "@/lib/mfa";
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
    { email: "", additional_information: "" },
    { email: "manager@example.com", additional_information: "" },
    { email: "", additional_information: "A note for the organizer" },
  ])("accepts browser-normalized optional fields at both server entry points", (optional) => {
    const submitted = JSON.parse(
      JSON.stringify(registrationSchema.parse({ ...valid, ...optional })),
    );
    expect(registrationSchema.safeParse(submitted).success).toBe(true);
    expect(teamFieldsSchema.safeParse(submitted).success).toBe(true);
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
describe("authenticator QR rendering", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0 0h1v1H0z"/></svg>\n';
  it.each([
    svg,
    `data:image/svg+xml;utf-8,${svg}`,
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  ])("renders SVG enrollment images without raw control characters or URL fragments", (input) => {
    const source = authenticatorQrSource(input);
    expect(source).not.toMatch(/\s/);
    expect(new URL(source).hash).toBe("");
    expect(decodeURIComponent(source.slice(source.indexOf(",") + 1)).trim()).toBe(svg.trim());
  });
  it("preserves base64 enrollment images", () => {
    const source = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(authenticatorQrSource(`${source}\n`)).toBe(source);
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
  it("opens the choice page without autolaunch and preserves the registration details", () => {
    const text = paymentMessage({
      reference: "VL-TEST-2026-000001",
      team: "Eagles & Stars",
      manager: "Ada Okafor",
      fee: 100,
    });
    const link = new URL(whatsappLink("+234 803 123 4567", text)!);
    expect(link.origin).toBe("https://api.whatsapp.com");
    expect(link.pathname).toBe("/send");
    expect(link.searchParams.get("phone")).toBe("2348031234567");
    expect(link.searchParams.get("text")).toBe(text);
    expect(link.searchParams.get("autoload")).toBe("0");
    expect(text).toContain("Eagles & Stars");
  });
  it.each(["", "08031234567"])("rejects a missing or malformed organizer number: %s", (number) => {
    expect(whatsappLink(number, "Hello")).toBeNull();
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
