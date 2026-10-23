export function registrationTimeLeft(deadline: string, now: number) {
  const milliseconds = Date.parse(deadline) - now;
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return {
    expired: milliseconds <= 0,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}
