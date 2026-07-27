export interface ResetTimeInfo {
  relative: string;
  absolute: string;
}

const DURATION_REGEX =
  /Resets in (?:(\d+)\s*hr(?:s)?)?\s*(?:(\d+)\s*min(?:s)?)?/i;

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function parseResetTime(
  resetText: string,
  now: number = Date.now(),
): ResetTimeInfo | null {
  const match = resetText.match(DURATION_REGEX);
  if (!match || (!match[1] && !match[2])) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const mins = match[2] ? parseInt(match[2], 10) : 0;
  const totalMs = (hours * 60 + mins) * 60 * 1000;

  const relative = hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;
  const absolute = TIME_FORMATTER.format(new Date(now + totalMs));

  return { relative, absolute };
}
