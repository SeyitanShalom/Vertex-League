import { describe, expect, it } from "vitest";
import { registrationTimeLeft } from "@/lib/registration/countdown";

const deadline = "2026-11-01T18:00:00Z";
const end = Date.parse(deadline);

describe("registration countdown", () => {
  it("shows whole days, hours, minutes and seconds", () => {
    expect(registrationTimeLeft(deadline, end - 93_784_000)).toEqual({
      expired: false,
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
    });
  });

  it("keeps the last second visible until the exact deadline", () => {
    expect(registrationTimeLeft(deadline, end - 1)).toEqual({
      expired: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
  });

  it("expires at the deadline and never shows negative time", () => {
    for (const now of [end, end + 60_000]) {
      expect(registrationTimeLeft(deadline, now)).toEqual({
        expired: true,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      });
    }
  });
});
