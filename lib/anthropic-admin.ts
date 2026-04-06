import "server-only";

import type {
  AnthropicCostBucketRaw,
  AnthropicReportPage,
  AnthropicUsageBucketRaw,
  CostBucket,
  CostResult,
  GroupDimension,
  GroupedValue,
  ReportQuery,
  UsageBucket,
  UsageResult,
} from "@/lib/types";

const USAGE_ENDPOINT = "/v1/organizations/usage_report/messages";
const COST_ENDPOINT = "/v1/organizations/cost_report";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const CACHE_TTL_MS = 60_000;
const requestCache = new Map<string, { expiresAt: number; payload: unknown }>();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function getBaseUrl(): string {
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function mapGroupBy(groupBy: GroupDimension[] | undefined): string[] {
  if (!groupBy || groupBy.length === 0) {
    return [];
  }

  return groupBy.map((dimension) => {
    if (dimension === "workspace") {
      return "workspace_id";
    }

    if (dimension === "apiKey") {
      return "api_key_id";
    }

    if (dimension === "serviceTier") {
      return "service_tier";
    }

    return dimension;
  });
}

function buildQueryString(query: ReportQuery): string {
  const search = new URLSearchParams({
    starting_at: query.startingAt,
    ending_at: query.endingAt,
    bucket_width: query.bucketWidth,
  });

  if (query.model) {
    search.append("model", query.model);
  }

  if (query.workspace) {
    search.append("workspace_id", query.workspace);
  }

  if (query.apiKey) {
    search.append("api_key_id", query.apiKey);
  }

  if (query.serviceTier) {
    search.append("service_tier", query.serviceTier);
  }

  for (const groupedDimension of mapGroupBy(query.groupBy)) {
    search.append("group_by[]", groupedDimension);
  }

  if (query.page) {
    search.append("page", query.page);
  }

  return search.toString();
}

async function fetchJsonWithRetry<T>(url: string, init: RequestInit): Promise<T> {
  const cached = requestCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload as T;
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt < 4) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
      });

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status)) {
          throw new Error(`Anthropic API retryable failure: ${response.status}`);
        }

        const body = await response.text();
        throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
      }

      const json = (await response.json()) as T;
      requestCache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, payload: json });
      return json;
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt >= 4) {
        break;
      }

      const backoffMs = attempt * 250;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Anthropic API request failed");
}

async function fetchAllPages<TBucket>(endpoint: string, query: ReportQuery): Promise<TBucket[]> {
  const apiKey = requiredEnv("ANTHROPIC_ADMIN_API_KEY");
  const anthropicVersion = requiredEnv("ANTHROPIC_VERSION");
  const anthropicBeta = optionalEnv("ANTHROPIC_BETA");

  const headers: HeadersInit = {
    "x-api-key": apiKey,
    "anthropic-version": anthropicVersion,
  };

  if (anthropicBeta) {
    headers["anthropic-beta"] = anthropicBeta;
  }

  let page: string | undefined;
  const allBuckets: TBucket[] = [];

  do {
    const url = `${getBaseUrl()}${endpoint}?${buildQueryString({ ...query, page })}`;
    const pageData = await fetchJsonWithRetry<AnthropicReportPage<TBucket>>(url, {
      method: "GET",
      headers,
    });

    if (Array.isArray(pageData.data) && pageData.data.length > 0) {
      allBuckets.push(...pageData.data);
    }

    page = pageData.has_more ? pageData.next_page || undefined : undefined;
  } while (page);

  return allBuckets;
}

function normalizeUsageResult(raw: AnthropicUsageBucketRaw["results"][number]): UsageResult {
  const inputTokens = raw.input_tokens ?? 0;
  const outputTokens = raw.output_tokens ?? 0;
  const cacheCreationInputTokens = raw.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = raw.cache_read_input_tokens ?? 0;
  const inferredRequests = raw.requests ?? raw.requests_count ?? raw.num_requests ?? 0;
  const tokenTotal = inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens;
  const usageUnits = inferredRequests > 0 ? inferredRequests : tokenTotal;

  return {
    model: raw.model || "unknown",
    workspace: raw.workspace_id || "unknown",
    apiKey: raw.api_key_id || "unknown",
    serviceTier: raw.service_tier || "unknown",
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    requests: inferredRequests,
    usageUnits,
  };
}

function normalizeCostResult(raw: AnthropicCostBucketRaw["results"][number]): CostResult {
  const costUsd = raw.cost_usd ?? raw.amount_usd ?? raw.usd ?? raw.cost ?? raw.amount ?? 0;

  return {
    model: raw.model || "unknown",
    workspace: raw.workspace_id || "unknown",
    apiKey: raw.api_key_id || "unknown",
    serviceTier: raw.service_tier || "unknown",
    costUsd,
  };
}

function sumUsage(results: UsageResult[]): { usage: number; requests: number } {
  return results.reduce(
    (acc, result) => {
      acc.usage += result.usageUnits;
      acc.requests += result.requests;
      return acc;
    },
    { usage: 0, requests: 0 },
  );
}

function sumCost(results: CostResult[]): number {
  return results.reduce((total, result) => total + result.costUsd, 0);
}

export async function getUsageReport(query: ReportQuery): Promise<UsageBucket[]> {
  const rawBuckets = await fetchAllPages<AnthropicUsageBucketRaw>(USAGE_ENDPOINT, query);

  return rawBuckets.map((bucket) => {
    const results = bucket.results.map(normalizeUsageResult);
    const totals = sumUsage(results);

    return {
      startTime: bucket.start_time,
      endTime: bucket.end_time,
      totalUsage: totals.usage,
      totalRequests: totals.requests,
      results,
    };
  });
}

export async function getCostReport(query: ReportQuery): Promise<CostBucket[]> {
  const rawBuckets = await fetchAllPages<AnthropicCostBucketRaw>(COST_ENDPOINT, query);

  return rawBuckets.map((bucket) => {
    const results = bucket.results.map(normalizeCostResult);

    return {
      startTime: bucket.start_time,
      endTime: bucket.end_time,
      totalCostUsd: sumCost(results),
      results,
    };
  });
}

function groupKey(result: UsageResult, dimension: GroupDimension): string {
  if (dimension === "workspace") {
    return result.workspace;
  }

  if (dimension === "apiKey") {
    return result.apiKey;
  }

  if (dimension === "serviceTier") {
    return result.serviceTier;
  }

  return result.model;
}

export function groupUsageValues(buckets: UsageBucket[], dimension: GroupDimension): GroupedValue[] {
  const grouped = new Map<string, GroupedValue>();

  for (const bucket of buckets) {
    for (const result of bucket.results) {
      const key = groupKey(result, dimension);
      const current = grouped.get(key) ?? {
        key,
        label: key,
        usage: 0,
        costUsd: 0,
      };

      current.usage += result.usageUnits;
      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort((a, b) => b.usage - a.usage).slice(0, 12);
}

export function mergeCostIntoGroups(
  groups: GroupedValue[],
  costs: CostBucket[],
  dimension: GroupDimension,
): GroupedValue[] {
  const costByKey = new Map<string, number>();

  for (const bucket of costs) {
    for (const costItem of bucket.results) {
      const key =
        dimension === "workspace"
          ? costItem.workspace
          : dimension === "apiKey"
            ? costItem.apiKey
            : dimension === "serviceTier"
              ? costItem.serviceTier
              : costItem.model;
      costByKey.set(key, (costByKey.get(key) ?? 0) + costItem.costUsd);
    }
  }

  return groups.map((group) => ({
    ...group,
    costUsd: costByKey.get(group.key) ?? 0,
  }));
}
