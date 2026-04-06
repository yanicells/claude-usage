"use client";

import type { BucketWidth, DashboardFilters } from "@/lib/types";

interface FiltersToolbarProps {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  onApply: () => void;
  onReset: () => void;
  options: {
    models: string[];
    workspaces: string[];
    apiKeys: string[];
    serviceTiers: string[];
  };
  loading?: boolean;
}

const bucketOptions: Array<{ label: string; value: BucketWidth }> = [
  { label: "1 day", value: "1d" },
  { label: "1 hour", value: "1h" },
  { label: "1 minute", value: "1m" },
];

function InputLabel({ label }: { label: string }) {
  return <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-600">{label}</span>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="min-w-0">
      <InputLabel label={label} />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FiltersToolbar({
  filters,
  onChange,
  onApply,
  onReset,
  options,
  loading = false,
}: FiltersToolbarProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <InputLabel label="Start" />
          <input
            type="datetime-local"
            value={filters.start || ""}
            onChange={(event) => onChange({ ...filters, start: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <InputLabel label="End" />
          <input
            type="datetime-local"
            value={filters.end || ""}
            onChange={(event) => onChange({ ...filters, end: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label>
          <InputLabel label="Bucket" />
          <select
            value={filters.bucketWidth || "1d"}
            onChange={(event) =>
              onChange({
                ...filters,
                bucketWidth: event.target.value as BucketWidth,
              })
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            {bucketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <InputLabel label="Timezone" />
          <input
            type="text"
            value={filters.timezone || ""}
            onChange={(event) => onChange({ ...filters, timezone: event.target.value })}
            placeholder="Asia/Manila"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label="Model"
          value={filters.model || ""}
          options={options.models}
          onChange={(value) => onChange({ ...filters, model: value || undefined })}
        />

        <SelectField
          label="Workspace"
          value={filters.workspace || ""}
          options={options.workspaces}
          onChange={(value) => onChange({ ...filters, workspace: value || undefined })}
        />

        <SelectField
          label="API Key"
          value={filters.apiKey || ""}
          options={options.apiKeys}
          onChange={(value) => onChange({ ...filters, apiKey: value || undefined })}
        />

        <SelectField
          label="Service Tier"
          value={filters.serviceTier || ""}
          options={options.serviceTiers}
          onChange={(value) => onChange({ ...filters, serviceTier: value || undefined })}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Apply Filters"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
