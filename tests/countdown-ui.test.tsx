import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RegistrationEntryAction,
  RegistrationHeroAction,
} from "@/components/home/registration-entry-action";
import { RegistrationCountdown } from "@/components/registration/registration-countdown";
import { REGISTRATION_DEADLINE_PASSED } from "@/lib/registration/rules";

const deadline = "2026-11-01T18:00:00Z";

describe("registration deadline controls", () => {
  it("renders a disabled start button when the deadline has passed", () => {
    const markup = renderToStaticMarkup(
      <RegistrationEntryAction deadline={deadline} unavailable={REGISTRATION_DEADLINE_PASSED} />,
    );
    expect(markup).toContain("Registration closed");
    expect(markup).toMatch(/<button[^>]*disabled/);
    expect(markup).not.toContain('href="/register"');
  });

  it("renders an active registration link before the deadline", () => {
    const markup = renderToStaticMarkup(
      <RegistrationEntryAction deadline={deadline} unavailable={null} />,
    );
    expect(markup).toContain('href="/register"');
    expect(markup).toContain("Start your registration");
  });

  it("disables the hero registration button after the deadline", () => {
    const markup = renderToStaticMarkup(
      <RegistrationHeroAction
        deadline={deadline}
        deadlineLabel="1 Nov 2026, 7:00 pm WAT"
        registrationEnabled
        unavailable={REGISTRATION_DEADLINE_PASSED}
      />,
    );
    expect(markup).toMatch(/<button[^>]*disabled/);
    expect(markup).not.toContain('href="#rules"');
  });

  it("shows four stable countdown units", () => {
    const markup = renderToStaticMarkup(
      <RegistrationCountdown
        deadline={deadline}
        deadlineLabel="1 Nov 2026, 7:00 pm WAT"
        remaining={{ expired: false, days: 2, hours: 3, minutes: 4, seconds: 5 }}
      />,
    );
    for (const unit of ["Days", "Hours", "Minutes", "Seconds"]) {
      expect(markup).toContain(unit);
    }
    expect(markup).toContain("05");
  });
});
