"use client";
import { useEffect, useState } from "react";
import { registrationTimeLeft } from "@/lib/registration/countdown";

export function useRegistrationCountdown(deadline: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [deadline]);
  return deadline && now !== null ? registrationTimeLeft(deadline, now) : null;
}

export function RegistrationCountdown({
  deadline,
  deadlineLabel,
  remaining,
  compact = false,
}: {
  deadline: string;
  deadlineLabel: string;
  remaining: ReturnType<typeof registrationTimeLeft> | null;
  compact?: boolean;
}) {
  const units = [
    ["Days", remaining?.days],
    ["Hours", remaining?.hours],
    ["Minutes", remaining?.minutes],
    ["Seconds", remaining?.seconds],
  ] as const;
  return (
    <div
      className={`registration-countdown${compact ? " registration-countdown--compact" : ""}`}
      role="timer"
      aria-live="off"
      aria-label={
        !remaining
          ? "Registration countdown loading"
          : remaining.expired
            ? "Registration closed"
            : `Registration closes in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds`
      }
    >
      <span className="tiny-label">
        {remaining?.expired ? "REGISTRATION CLOSED" : "REGISTRATION CLOSES IN"}
      </span>
      <div className="registration-countdown-grid" aria-hidden="true">
        {units.map(([label, value]) => (
          <div key={label}>
            <strong>{value === undefined ? "--" : String(value).padStart(2, "0")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <time dateTime={deadline}>{deadlineLabel}</time>
    </div>
  );
}
