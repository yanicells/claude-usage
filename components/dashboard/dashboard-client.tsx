"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CostLineChart } from "@/components/charts/cost-line-chart";
import { GroupedUsageChart } from "@/components/charts/grouped-usage-chart";
import { PacingChart } from "@/components/charts/pacing-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { FiltersToolbar } from "@/components/dashboard/filters-toolbar";
import { OverviewCard } from "@/components/dashboard/overview-card";
import { SettingsEditor } from "@/components/settings/settings-editor";
import type { AppSettings, CostApiResponse, DashboardFilters, UsageApiResponse } from "@/lib/types";

function toDatetimeLocal(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function toIsoFromDatetimeLocal(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatStatus(status: string): string {
  if (status === "on-track") {
    return "on track";
  }

  return status;
}

function statusTone(status: string): "good" | "warn" | "bad" {
  if (status === "ahead") {
    return "good";
  }

  if (status === "behind") {
    return "bad";
  }

  return "warn";
}

export function DashboardClient() {
  const [usageData, setUsageData] = useState<UsageApiResponse | null>(null);
  const [costData, setCostData] = useState<CostApiResponse | null>(null);
  const [settingsData, setSettingsData] = useState<AppSettings | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const requestData = useCallback(async (nextFilters: DashboardFilters, updateFilters = false) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        const startIso = toIsoFromDatetimeLocal(nextFilters.start);
        const endIso = toIsoFromDatetimeLocal(nextFilters.end);

        if (startIso) {
          params.set("startingAt", startIso);
        }

        if (endIso) {
          params.set("endingAt", endIso);
        }

        if (nextFilters.bucketWidth) {
          params.set("bucketWidth", nextFilters.bucketWidth);
        }

        if (nextFilters.timezone) {
          params.set("timezone", nextFilters.timezone);
        }

        if (nextFilters.model) {
          params.set("model", nextFilters.model);
        }

        if (nextFilters.workspace) {
          params.set("workspace", nextFilters.workspace);
        }

        if (nextFilters.apiKey) {
          params.set("apiKey", nextFilters.apiKey);
        }

        if (nextFilters.serviceTier) {
          params.set("serviceTier", nextFilters.serviceTier);
        }

        const [usageResponse, costResponse] = await Promise.all([
          fetch(`/api/usage?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/cost?${params.toString()}`, { cache: "no-store" }),
        ]);

        const usageJson = (await usageResponse.json()) as UsageApiResponse & { error?: string };
        const costJson = (await costResponse.json()) as CostApiResponse & { error?: string };

        if (!usageResponse.ok || usageJson.error) {
          throw new Error(usageJson.error || "Failed to fetch usage data");
        }

        if (!costResponse.ok || costJson.error) {
          throw new Error(costJson.error || "Failed to fetch cost data");
        }

        setUsageData(usageJson);
        setCostData(costJson);
        setSettingsData(usageJson.settings);

        if (!hasInitialized.current || updateFilters) {
          setFilters({
            ...nextFilters,
            start: toDatetimeLocal(usageJson.queryRange.startingAt),
            end: toDatetimeLocal(usageJson.queryRange.endingAt),
            bucketWidth: usageJson.queryRange.bucketWidth,
            timezone: usageJson.settings.timezone,
          });
        }

        hasInitialized.current = true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to fetch dashboard data";
        setError(message);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void requestData({}, true);
  }, [requestData]);

  const selectOptions = useMemo(() => {
    if (!usageData) {
      return {
        models: [],
        workspaces: [],
        apiKeys: [],
        serviceTiers: [],
      };
    }

    return {
      models: usageData.groupedByModel.map((item) => item.label),
      workspaces: usageData.groupedByWorkspace.map((item) => item.label),
      apiKeys: usageData.groupedByApiKey.map((item) => item.label),
      serviceTiers: usageData.groupedByServiceTier.map((item) => item.label),
    };
  }, [usageData]);

  const summary = useMemo(() => {
    if (!usageData) {
      return null;
    }

    const resetDay = usageData.settings.resetDay;
    const resetHour = usageData.settings.resetHour.toString().padStart(2, "0");
    const resetTime = `${resetHour}:00`;

    return `Reset: ${resetDay} ${resetTime}, Timezone: ${usageData.settings.timezone}, Expected by now: ${usageData.comparison.expected}, Actual: ${usageData.comparison.actual}, Delta: ${usageData.comparison.delta}, Status: ${formatStatus(usageData.comparison.status)}.`;
  }, [usageData]);

  const projectionEndsEarly = useMemo(() => {
    if (!usageData || usageData.weeklyExpectedSeries.length === 0) {
      return false;
    }

    const finalValue = usageData.weeklyExpectedSeries[usageData.weeklyExpectedSeries.length - 1]?.expected ?? 0;
    return finalValue < usageData.settings.weeklyTargetPercent;
  }, [usageData]);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-8 md:px-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-100 p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Anthropic Usage Tracker</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Internal dashboard using Anthropic Admin API usage and cost reports. Weekly pacing is controlled by
          server-side local settings and compared against real usage in the current cycle.
        </p>
      </section>

      <div className="mt-6">
        <FiltersToolbar
          filters={filters}
          onChange={setFilters}
          onApply={() => void requestData(filters)}
          onReset={() => {
            setFilters({});
            void requestData({}, true);
          }}
          options={selectOptions}
          loading={loading}
        />
      </div>

      {error ? (
        <section className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load dashboard data: {error}
        </section>
      ) : null}

      {!usageData || !costData ? (
        <section className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 text-sm text-slate-600">
          {loading ? "Loading usage and cost reports..." : "No data available yet."}
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <OverviewCard title="Total Usage" value={formatNumber(usageData.totalUsage)} subtitle="Selected range" />
            <OverviewCard title="Total Cost" value={formatMoney(costData.totalCostUsd)} subtitle="Selected range" />
            <OverviewCard title="Expected Progress" value={String(usageData.comparison.expected)} subtitle="Current weekly checkpoint" />
            <OverviewCard title="Actual Progress" value={String(usageData.comparison.actual)} subtitle="Current weekly usage" />
            <OverviewCard
              title="Delta"
              value={`${usageData.comparison.delta > 0 ? "+" : ""}${usageData.comparison.delta}`}
              subtitle="Actual minus expected"
              tone={usageData.comparison.delta >= 0 ? "good" : "bad"}
            />
            <OverviewCard
              title="Status"
              value={formatStatus(usageData.comparison.status)}
              subtitle="Behind / On Track / Ahead"
              tone={statusTone(usageData.comparison.status)}
            />
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Daily Usage</h2>
              <UsageLineChart data={usageData.usageSeries} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Daily Cost</h2>
              <CostLineChart data={costData.costSeries} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Weekly Pacing</h2>
            <PacingChart
              expected={usageData.weeklyExpectedSeries}
              actual={usageData.weeklyActualSeries}
              currentSlot={usageData.currentSlot}
            />
            {summary ? <p className="mt-3 text-sm text-slate-700">{summary}</p> : null}
            {projectionEndsEarly ? (
              <p className="mt-1 text-xs text-slate-500">
                Simple integer pacing mode is enabled. The weekly projection may intentionally end below the target,
                for example 98 instead of 100 when increment is 14.
              </p>
            ) : null}
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            <GroupedUsageChart title="Grouped Usage by Model" data={usageData.groupedByModel} />
            <GroupedUsageChart title="Grouped Usage by Workspace" data={usageData.groupedByWorkspace} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-2">
            <GroupedUsageChart title="Grouped Usage by API Key" data={usageData.groupedByApiKey} />
            <GroupedUsageChart title="Grouped Usage by Service Tier" data={usageData.groupedByServiceTier} />
          </section>

          {settingsData ? (
            <section className="mt-6">
              <SettingsEditor
                settings={settingsData}
                onSaved={(nextSettings) => {
                  setSettingsData(nextSettings);
                  setFilters((previous) => ({ ...previous, timezone: nextSettings.timezone }));
                  void requestData(
                    {
                      ...filters,
                      timezone: nextSettings.timezone,
                    },
                    true,
                  );
                }}
              />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
