import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Team } from "@/types/domain";

vi.mock("@/components/registration/team-form", () => ({
  TeamForm: () => <form data-testid="approved-correction-form" />,
}));

import { TeamCorrections } from "@/components/registration/team-corrections";

const team: Team = {
  id: "team-id",
  team_name: "Eagles & Stars",
  manager_name: "Test Manager",
  phone: "+2348031234567",
  whatsapp_number: "+2348031234567",
  email: "team@example.com",
  location: "Akure South",
  logo_path: null,
  additional_information: null,
};
const common = { reference: "VL-TEST-2026-000001", team, whatsapp: "+2348031234567" };

describe("paid correction access", () => {
  it.each([
    "submitted",
    "awaiting_screening",
    "correction_required",
    "approved",
    "rejected",
  ] as const)(
    "shows organizer contact without an edit form for unapproved %s records",
    (status) => {
      const markup = renderToStaticMarkup(
        <TeamCorrections {...common} status={status} correctionApprovedAt={null} />,
      );
      expect(markup).toContain("Contact the organizer");
      expect(markup).toContain("₦2,000");
      expect(markup).not.toContain("<form");
      const href = markup.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&");
      const link = new URL(href);
      expect(link.origin).toBe("https://api.whatsapp.com");
      expect(link.searchParams.get("autoload")).toBe("0");
      expect(link.searchParams.get("text")).toContain(common.reference);
      expect(link.searchParams.get("text")).toContain(team.team_name);
      expect(link.searchParams.get("text")).toContain("₦2,000");
      expect(link.searchParams.has("key")).toBe(false);
      expect(link.searchParams.get("text")).not.toContain("token");
    },
  );

  it("reveals the form only after paid approval and explains that saving locks it again", () => {
    const markup = renderToStaticMarkup(
      <TeamCorrections
        {...common}
        status="correction_required"
        correctionApprovedAt="2026-10-25T12:00:00Z"
      />,
    );
    expect(markup).toContain("approved-correction-form");
    expect(markup).toContain("approved one correction submission");
    expect(markup).toContain("Saving locks your details again");
  });

  it("keeps final records locked even with a stale approval timestamp", () => {
    const markup = renderToStaticMarkup(
      <TeamCorrections {...common} status="approved" correctionApprovedAt="2026-10-25T12:00:00Z" />,
    );
    expect(markup).not.toContain("<form");
  });

  it("does not invent a chat destination when the organizer number is missing", () => {
    const markup = renderToStaticMarkup(
      <TeamCorrections {...common} whatsapp="" status="submitted" correctionApprovedAt={null} />,
    );
    expect(markup).not.toContain("href=");
    expect(markup).not.toContain("<form");
  });
});
