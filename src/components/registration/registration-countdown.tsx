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
  forceZero = false,
  compact = false,
}: {
  deadline: string | null;
  deadlineLabel: string | null;
  remaining: ReturnType<typeof registrationTimeLeft> | null;
  forceZero?: boolean;
  compact?: boolean;
}) {
  const units = forceZero
    ? ([
        ["Hours", 0],
        ["Minutes", 0],
        ["Seconds", 0],
      ] as const)
    : ([
        ["Days", remaining?.days],
        ["Hours", remaining?.hours],
        ["Minutes", remaining?.minutes],
        ["Seconds", remaining?.seconds],
      ] as const);
  const label = forceZero
    ? "Registration closed. Countdown 00:00:00"
    : !remaining
      ? "Registration countdown loading"
      : remaining.expired
        ? "Registration closed"
        : `Registration closes in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds`;
  return (
    <div
      className={`registration-countdown${compact ? " registration-countdown--compact" : ""}`}
      role="timer"
      aria-live="off"
      aria-label={label}
    >
      <span className="tiny-label">
        {forceZero || remaining?.expired ? "REGISTRATION CLOSED" : "REGISTRATION CLOSES IN"}
      </span>
      <div
        className={`registration-countdown-grid${forceZero ? " registration-countdown-grid--time" : ""}`}
        aria-hidden="true"
      >
        {units.map(([label, value]) => (
          <div key={label}>
            <strong>{value === undefined ? "--" : String(value).padStart(2, "0")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!forceZero && deadline && deadlineLabel && <time dateTime={deadline}>{deadlineLabel}</time>}
    </div>
  );
}
