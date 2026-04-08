import { DateTime } from "luxon";

export const PH_TIMEZONE = "Asia/Manila";
export const LOCAL_STORAGE_KEY = "claude-usage-companion.latest";

const SIMPLE_EXPECTED_STEPS = [14, 28, 42, 56, 70, 84, 98] as const;
const RESET_LINE_REGEX = /^resets\s+(sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i;
const SESSION_RESET_REGEX = /^resets\s+in\s+/i;
const USED_PERCENT_REGEX = /^(\d{1,3})%\s*used$/i;

type PaceStatus = "ahead" | "on-track" | "behind";
type FasterMode = "faster" | "normal";

export interface CompanionState {
  rawText: string;
  plan: string | null;
  sessionUsedPercent: number | null;
  sessionResetText: string | null;
  weeklyUsedPercent: number | null;
  weeklyResetText: string | null;
  parsedAt: string;
  weeklyManuallyEdited: boolean;
  manualWeeklyUsedPercent: number | null;
}

export interface ParsedStatus {
  planParsed: boolean;
  sessionParsed: boolean;
  sessionPartial: boolean;
  weeklyParsed: boolean;
  weeklyPartial: boolean;
  message: string;
}

export interface ParsedUsageResult {
  parsed: Pick<
    CompanionState,
    "plan" | "sessionUsedPercent" | "sessionResetText" | "weeklyUsedPercent" | "weeklyResetText"
  >;
  status: ParsedStatus;
}

export interface WeeklyProjectionPoint {
  index: number;
  checkpointIso: string;
  checkpointEpochMs: number;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  expectedCumulativePercent: number;
}

export interface WeeklyPaceComparison {
  expected: number;
  actual: number;
  delta: number;
  status: PaceStatus;
}

export interface FasterLimitsStatus {
  mode: FasterMode;
  isActive: boolean;
  windowStartIso: string | null;
  windowEndIso: string | null;
}

const RESET_DAY_TO_WEEKDAY: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

function isNoiseLine(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "plan usage limits" ||
    normalized === "current session" ||
    normalized === "weekly limits" ||
    normalized === "all models" ||
    normalized.startsWith("learn more") ||
    normalized.startsWith("last updated")
  );
}

function normalizeLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseUsedPercent(line: string): number | null {
  const match = line.match(USED_PERCENT_REGEX);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, parsed));
}

function nowInPh(nowInput?: DateTime): DateTime {
  return (nowInput ?? DateTime.now()).setZone(PH_TIMEZONE);
}

function buildParseMessage(status: Omit<ParsedStatus, "message">): string {
  if (status.weeklyParsed && status.sessionParsed) {
    return "Parsed weekly and current session successfully.";
  }

  if (status.weeklyParsed && !status.sessionPartial) {
    return "Parsed weekly successfully. Current session section was not found.";
  }

  if (status.weeklyParsed && status.sessionPartial && !status.sessionParsed) {
    return "Parsed weekly successfully. Current session was only parsed partially.";
  }

  if (!status.weeklyPartial && status.sessionParsed) {
    return "Parsed current session successfully. Weekly section was not found.";
  }

  if (status.weeklyPartial && !status.weeklyParsed && status.sessionParsed) {
    return "Parsed current session successfully. Weekly section was only parsed partially.";
  }

  if (status.weeklyPartial || status.sessionPartial || status.planParsed) {
    return "Parsed partial content. Some expected usage fields are missing.";
  }

  return "Could not parse recognized Claude usage fields. Paste the full Plan usage limits block.";
}

export function parseClaudeUsageBlock(rawText: string): ParsedUsageResult {
  const lines = normalizeLines(rawText);
  const planIndex = lines.findIndex((line) => line.toLowerCase() === "plan usage limits");
  const sessionIndex = lines.findIndex((line) => line.toLowerCase() === "current session");
  const weeklyIndex = lines.findIndex((line) => line.toLowerCase() === "weekly limits");

  let plan: string | null = null;
  let sessionResetText: string | null = null;
  let sessionUsedPercent: number | null = null;
  let weeklyResetText: string | null = null;
  let weeklyUsedPercent: number | null = null;

  if (planIndex >= 0) {
    const endIndex = [sessionIndex, weeklyIndex].filter((value) => value > planIndex).sort((a, b) => a - b)[0] ?? lines.length;

    for (let index = planIndex + 1; index < endIndex; index += 1) {
      const line = lines[index] ?? "";
      if (isNoiseLine(line) || SESSION_RESET_REGEX.test(line) || RESET_LINE_REGEX.test(line) || parseUsedPercent(line) !== null) {
        continue;
      }

      plan = line;
      break;
    }
  }

  if (sessionIndex >= 0) {
    const endIndex = weeklyIndex > sessionIndex ? weeklyIndex : lines.length;

    for (let index = sessionIndex + 1; index < endIndex; index += 1) {
      const line = lines[index] ?? "";

      if (!sessionResetText && SESSION_RESET_REGEX.test(line)) {
        sessionResetText = line;
      }

      if (sessionUsedPercent === null) {
        sessionUsedPercent = parseUsedPercent(line);
      }
    }
  }

  if (weeklyIndex >= 0) {
    for (let index = weeklyIndex + 1; index < lines.length; index += 1) {
      const line = lines[index] ?? "";

      if (!weeklyResetText && (RESET_LINE_REGEX.test(line) || SESSION_RESET_REGEX.test(line))) {
        weeklyResetText = line;
      }

      if (weeklyUsedPercent === null) {
        weeklyUsedPercent = parseUsedPercent(line);
      }
    }
  }

  if (!weeklyResetText) {
    weeklyResetText = lines.find((line) => RESET_LINE_REGEX.test(line) || SESSION_RESET_REGEX.test(line)) ?? null;
  }

  if (weeklyUsedPercent === null) {
    const allPercents = lines.map((line) => parseUsedPercent(line)).filter((value): value is number => value !== null);
    if (allPercents.length > 1) {
      weeklyUsedPercent = allPercents[allPercents.length - 1] ?? null;
    }
  }

  if (sessionUsedPercent === null) {
    const allPercents = lines.map((line) => parseUsedPercent(line)).filter((value): value is number => value !== null);
    if (allPercents.length > 1) {
      sessionUsedPercent = allPercents[0] ?? null;
    }
  }

  if (!sessionResetText) {
    sessionResetText = lines.find((line) => SESSION_RESET_REGEX.test(line)) ?? null;
  }

  const sessionPartial = sessionUsedPercent !== null || sessionResetText !== null;
  const weeklyPartial = weeklyUsedPercent !== null || weeklyResetText !== null;

  const statusWithoutMessage = {
    planParsed: plan !== null,
    sessionParsed: sessionUsedPercent !== null && sessionResetText !== null,
    sessionPartial,
    weeklyParsed: weeklyUsedPercent !== null && weeklyResetText !== null,
    weeklyPartial,
  };

  return {
    parsed: {
      plan,
      sessionUsedPercent,
      sessionResetText,
      weeklyUsedPercent,
      weeklyResetText,
    },
    status: {
      ...statusWithoutMessage,
      message: buildParseMessage(statusWithoutMessage),
    },
  };
}

export function getCurrentWeeklyAnchorFromResetText(resetText: string, nowInput?: DateTime): DateTime | null {
  const now = nowInPh(nowInput);

  // Try fixed day/time format first (e.g., "Resets Thu 2:00 PM")
  const fixedMatch = resetText.trim().match(RESET_LINE_REGEX);
  if (fixedMatch) {
    const dayToken = (fixedMatch[1] ?? "").toLowerCase();
    const hourToken = Number.parseInt(fixedMatch[2] ?? "", 10);
    const minuteToken = Number.parseInt(fixedMatch[3] ?? "", 10);
    const periodToken = (fixedMatch[4] ?? "").toLowerCase();

    if (!Number.isFinite(hourToken) || !Number.isFinite(minuteToken)) {
      return null;
    }

    const targetWeekday = RESET_DAY_TO_WEEKDAY[dayToken];
    if (!targetWeekday) {
      return null;
    }

    let hour24 = hourToken % 12;
    if (periodToken === "pm") {
      hour24 += 12;
    }

    const daysAhead = (targetWeekday - now.weekday + 7) % 7;

    let candidate = now
      .startOf("day")
      .plus({ days: daysAhead })
      .set({ hour: hour24, minute: minuteToken, second: 0, millisecond: 0 });

    if (candidate > now) {
      candidate = candidate.minus({ days: 7 });
    }

    return candidate;
  }

  // Try duration format (e.g., "Resets in 1 hr 37 min" or "Resets in 22 hr 37 min")
  const durationMatch = resetText.trim().match(/Resets in (\d+)\s*hr(?:s)?\s*(?:(\d+)\s*min)?/i);
  if (durationMatch) {
    const hours = Number.parseInt(durationMatch[1] ?? "0", 10);
    const minutes = Number.parseInt(durationMatch[2] ?? "0", 10);

    if (!Number.isFinite(hours)) {
      return null;
    }

    const totalMs = (hours * 60 + minutes) * 60 * 1000;
    const nextReset = now.plus({ milliseconds: totalMs });

    // Assume a 7-day cycle: anchor is 7 days before the next reset
    return nextReset.minus({ days: 7 });
  }

  return null;
}

export function buildWeeklyProjection(anchor: DateTime): WeeklyProjectionPoint[] {
  return SIMPLE_EXPECTED_STEPS.map((expected, index) => {
    const checkpoint = anchor.plus({ days: index });

    return {
      index,
      checkpointIso: checkpoint.toISO() ?? "",
      checkpointEpochMs: checkpoint.toMillis(),
      dayLabel: checkpoint.toFormat("ccc"),
      dateLabel: checkpoint.toFormat("LLL d"),
      timeLabel: checkpoint.toFormat("h:mm a"),
      expectedCumulativePercent: expected,
    };
  });
}

export function getCurrentExpectedCheckpoint(
  projection: WeeklyProjectionPoint[],
  nowInput?: DateTime,
): WeeklyProjectionPoint | null {
  if (projection.length === 0) {
    return null;
  }

  const now = nowInPh(nowInput).toMillis();
  let current = projection[0] ?? null;

  for (const point of projection) {
    if (point.checkpointEpochMs <= now) {
      current = point;
    } else {
      break;
    }
  }

  return current;
}

export function compareWeeklyPace(actual: number, expected: number): WeeklyPaceComparison {
  const normalizedActual = Math.max(0, Math.min(100, Math.round(actual)));
  const normalizedExpected = Math.max(0, Math.min(100, Math.round(expected)));
  const delta = normalizedActual - normalizedExpected;

  let status: PaceStatus = "on-track";
  if (delta > 0) {
    status = "ahead";
  } else if (delta < 0) {
    status = "behind";
  }

  return {
    expected: normalizedExpected,
    actual: normalizedActual,
    delta,
    status,
  };
}

function isFasterStartDay(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function buildWindow(start: DateTime): { start: DateTime; end: DateTime } {
  return {
    start,
    end: start.plus({ hours: 6 }),
  };
}

export function getFasterLimitsStatusPH(nowInput?: DateTime): FasterLimitsStatus {
  const now = nowInPh(nowInput);
  const todayStart = now.startOf("day").set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  const yesterdayStart = todayStart.minus({ days: 1 });
  const candidates = [yesterdayStart, todayStart]
    .filter((start) => isFasterStartDay(start.weekday))
    .map((start) => buildWindow(start));

  for (const window of candidates) {
    if (now >= window.start && now < window.end) {
      return {
        mode: "faster",
        isActive: true,
        windowStartIso: window.start.toISO(),
        windowEndIso: window.end.toISO(),
      };
    }
  }

  return {
    mode: "normal",
    isActive: false,
    windowStartIso: null,
    windowEndIso: null,
  };
}

export function getNextFasterLimitsSwitchPH(nowInput?: DateTime): DateTime {
  const now = nowInPh(nowInput);
  const status = getFasterLimitsStatusPH(now);

  if (status.isActive && status.windowEndIso) {
    return DateTime.fromISO(status.windowEndIso).setZone(PH_TIMEZONE);
  }

  for (let offset = 0; offset <= 10; offset += 1) {
    const candidate = now
      .startOf("day")
      .plus({ days: offset })
      .set({ hour: 20, minute: 0, second: 0, millisecond: 0 });

    if (candidate > now && isFasterStartDay(candidate.weekday)) {
      return candidate;
    }
  }

  return now.plus({ days: 7 }).startOf("day").set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
}

export function formatCountdown(milliseconds: number): string {
  const clamped = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function createEmptyCompanionState(nowInput?: DateTime): CompanionState {
  const now = nowInPh(nowInput);

  return {
    rawText: "",
    plan: null,
    sessionUsedPercent: null,
    sessionResetText: null,
    weeklyUsedPercent: null,
    weeklyResetText: null,
    parsedAt: now.toISO() ?? "",
    weeklyManuallyEdited: false,
    manualWeeklyUsedPercent: null,
  };
}

export function parseStoredCompanionState(raw: string | null): CompanionState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CompanionState;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const fallback = createEmptyCompanionState();
    return {
      ...fallback,
      rawText: typeof parsed.rawText === "string" ? parsed.rawText : fallback.rawText,
      plan: typeof parsed.plan === "string" ? parsed.plan : null,
      sessionUsedPercent: Number.isFinite(parsed.sessionUsedPercent)
        ? Math.max(0, Math.min(100, Math.round(parsed.sessionUsedPercent as number)))
        : null,
      sessionResetText: typeof parsed.sessionResetText === "string" ? parsed.sessionResetText : null,
      weeklyUsedPercent: Number.isFinite(parsed.weeklyUsedPercent)
        ? Math.max(0, Math.min(100, Math.round(parsed.weeklyUsedPercent as number)))
        : null,
      weeklyResetText: typeof parsed.weeklyResetText === "string" ? parsed.weeklyResetText : null,
      parsedAt: typeof parsed.parsedAt === "string" && parsed.parsedAt.length > 0
        ? parsed.parsedAt
        : fallback.parsedAt,
      weeklyManuallyEdited: Boolean(parsed.weeklyManuallyEdited),
      manualWeeklyUsedPercent: Number.isFinite(parsed.manualWeeklyUsedPercent)
        ? Math.max(0, Math.min(100, Math.round(parsed.manualWeeklyUsedPercent as number)))
        : null,
    };
  } catch {
    return null;
  }
}
