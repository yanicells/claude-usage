export const RESET_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export const BUCKET_WIDTHS = ["1m", "1h", "1d"] as const;

export const GROUP_DIMENSIONS = [
  "model",
  "workspace",
  "apiKey",
  "serviceTier",
] as const;

export type ResetDay = (typeof RESET_DAYS)[number];
export type BucketWidth = (typeof BUCKET_WIDTHS)[number];
export type GroupDimension = (typeof GROUP_DIMENSIONS)[number];

export interface AppSettings {
  timezone: string;
  resetDay: ResetDay;
  resetHour: number;
  weeklyTargetPercent: number;
  simpleDailyIncrement: number;
  bucketWidth: BucketWidth;
}

export interface SettingsPatch {
  timezone?: string;
  resetDay?: string;
  resetHour?: number;
  weeklyTargetPercent?: number;
  simpleDailyIncrement?: number;
  bucketWidth?: string;
}

export interface RangeParams {
  startingAt: string;
  endingAt: string;
  bucketWidth: BucketWidth;
}

export interface UsageFilters {
  model?: string;
  workspace?: string;
  apiKey?: string;
  serviceTier?: string;
}

export interface DashboardFilters extends UsageFilters {
  start?: string;
  end?: string;
  bucketWidth?: BucketWidth;
  timezone?: string;
}

export interface ReportQuery extends RangeParams, UsageFilters {
  groupBy?: GroupDimension[];
  page?: string;
}

export interface AnthropicReportPage<TBucket> {
  data: TBucket[];
  has_more?: boolean;
  next_page?: string | null;
}

export interface AnthropicUsageResultRaw {
  model?: string | null;
  workspace_id?: string | null;
  api_key_id?: string | null;
  service_tier?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  requests?: number;
  requests_count?: number;
  num_requests?: number;
}

export interface AnthropicUsageBucketRaw {
  start_time: string;
  end_time: string;
  results: AnthropicUsageResultRaw[];
}

export interface AnthropicCostResultRaw {
  model?: string | null;
  workspace_id?: string | null;
  api_key_id?: string | null;
  service_tier?: string | null;
  amount?: number;
  amount_usd?: number;
  cost?: number;
  cost_usd?: number;
  usd?: number;
}

export interface AnthropicCostBucketRaw {
  start_time: string;
  end_time: string;
  results: AnthropicCostResultRaw[];
}

export interface UsageResult {
  model: string;
  workspace: string;
  apiKey: string;
  serviceTier: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  requests: number;
  usageUnits: number;
}

export interface CostResult {
  model: string;
  workspace: string;
  apiKey: string;
  serviceTier: string;
  costUsd: number;
}

export interface UsageBucket {
  startTime: string;
  endTime: string;
  totalUsage: number;
  totalRequests: number;
  results: UsageResult[];
}

export interface CostBucket {
  startTime: string;
  endTime: string;
  totalCostUsd: number;
  results: CostResult[];
}

export interface GroupedValue {
  key: string;
  label: string;
  usage: number;
  costUsd: number;
}

export interface WeeklyProjectionPoint {
  slot: number;
  day: ResetDay;
  label: string;
  expected: number;
}

export interface WeeklyActualPoint {
  slot: number;
  day: ResetDay;
  label: string;
  actual: number;
}

export interface PacingCycleRange {
  timezone: string;
  startIso: string;
  endIso: string;
}

export type PacingStatus = "behind" | "on-track" | "ahead";

export interface PacingComparison {
  expected: number;
  actual: number;
  delta: number;
  status: PacingStatus;
}

export interface OverviewStats {
  totalUsage: number;
  totalCostUsd: number;
  expectedProgress: number;
  actualProgress: number;
  delta: number;
  status: PacingStatus;
}

export interface UsageApiResponse {
  settings: AppSettings;
  cycleRange: PacingCycleRange;
  queryRange: RangeParams;
  currentSlot: number;
  comparison: PacingComparison;
  totalUsage: number;
  totalRequests: number;
  usageSeries: Array<{
    label: string;
    usage: number;
    cumulativeUsage: number;
    requests: number;
    startTime: string;
    endTime: string;
  }>;
  weeklyExpectedSeries: WeeklyProjectionPoint[];
  weeklyActualSeries: WeeklyActualPoint[];
  groupedByModel: GroupedValue[];
  groupedByWorkspace: GroupedValue[];
  groupedByApiKey: GroupedValue[];
  groupedByServiceTier: GroupedValue[];
}

export interface CostApiResponse {
  settings: AppSettings;
  totalCostUsd: number;
  costSeries: Array<{
    label: string;
    costUsd: number;
    cumulativeCostUsd: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface SettingsApiResponse {
  settings: AppSettings;
  sourcePath: string;
  usedFileOverrides: boolean;
}
