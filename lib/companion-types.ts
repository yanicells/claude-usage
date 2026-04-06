export const WEEK_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export interface CompanionSettings {
  timezone: string;
  weeklyResetDay: WeekDay;
  weeklyResetHour: number;
  weeklyTargetPercent: number;
  simpleDailyIncrement: number;
  fiveHourWindowHours: number;
  weeklyLimitLabel: string;
  fiveHourLimitLabel: string;
}

export interface UsageState {
  currentFiveHourUsagePercent: number;
  currentWeeklyUsagePercent: number;
  currentFiveHourWindowStartedAt: string;
  currentWeeklyCycleStartedAt: string;
  lastUpdatedAt: string;
  notes: string;
}

export interface UsageSnapshot {
  timestamp: string;
  fiveHourUsagePercent: number;
  weeklyUsagePercent: number;
  notes: string;
}

export interface UsageHistory {
  snapshots: UsageSnapshot[];
}

export type PaceStatus = "ahead" | "on-track" | "behind";

export interface WeeklyProgressPoint {
  slot: number;
  day: WeekDay;
  shortLabel: string;
  expectedCumulativePercent: number;
  isToday: boolean;
}

export interface CompanionComputed {
  paceStatus: PaceStatus;
  expectedWeeklyPercentNow: number;
  deltaWeeklyPercent: number;
  fiveHourRemainingPercent: number;
  weeklyRemainingPercent: number;
  nextFiveHourResetAt: string;
  nextWeeklyResetAt: string;
  currentWeeklySlot: number;
  progression: WeeklyProgressPoint[];
  guidance: string[];
}

export interface CompanionDashboardResponse {
  settings: CompanionSettings;
  state: UsageState;
  computed: CompanionComputed;
  recentSnapshots: UsageSnapshot[];
}

export interface SnapshotSaveInput {
  fiveHourUsageInput: string | number;
  weeklyUsagePercent: string | number;
  notes?: string;
  timestamp?: string;
  startNewFiveHourWindow?: boolean;
}
