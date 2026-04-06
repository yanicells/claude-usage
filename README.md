# Anthropic Usage Tracker Dashboard

Production-quality internal dashboard built with Next.js App Router, TypeScript, and Tailwind CSS.

It fetches real Anthropic organization usage and cost data server-side using the Admin API, then compares current usage against a weekly pacing plan configured by a local JSON settings file.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Production checks:

```bash
pnpm lint
pnpm build
pnpm start
```

## .env.local Example

```bash
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin-xxxx
ANTHROPIC_VERSION=2023-06-01
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_BETA=
DEFAULT_BUCKET_WIDTH=1d
DEFAULT_TIMEZONE=Asia/Manila
DEFAULT_RESET_DAY=friday
DEFAULT_RESET_HOUR=11
DEFAULT_WEEKLY_TARGET_PERCENT=100
DEFAULT_SIMPLE_DAILY_INCREMENT=14
SETTINGS_FILE_PATH=./config/settings.json
```

## config/settings.json Example

```json
{
  "timezone": "Asia/Manila",
  "resetDay": "friday",
  "resetHour": 11,
  "weeklyTargetPercent": 100,
  "simpleDailyIncrement": 14,
  "bucketWidth": "1d"
}
```

## Folder Structure

```txt
app/
	api/
		cost/route.ts
		settings/route.ts
		usage/route.ts
	globals.css
	layout.tsx
	loading.tsx
	page.tsx
components/
	charts/
		cost-line-chart.tsx
		grouped-usage-chart.tsx
		pacing-chart.tsx
		usage-line-chart.tsx
	dashboard/
		dashboard-client.tsx
		filters-toolbar.tsx
		overview-card.tsx
	settings/
		settings-editor.tsx
config/
	settings.json
lib/
	anthropic-admin.ts
	cn.ts
	pacing.ts
	settings.ts
	types.ts
```

## How to Obtain Anthropic Admin API Key

1. Sign in to Anthropic Console with an organization admin/owner account.
2. Navigate to admin API key management in your organization settings.
3. Create an Admin API key.
4. Put it in `.env.local` as `ANTHROPIC_ADMIN_API_KEY`.

Important: the key is only read on the server in route handlers and server-only helper modules.

## How the Local Settings File Works

1. The app loads fallback defaults from environment variables.
2. It then reads `SETTINGS_FILE_PATH` (default `./config/settings.json`).
3. JSON file values override env defaults.
4. Merged settings are used for pacing math and default UI filters.
5. The settings editor posts updates to `app/api/settings/route.ts` and writes the JSON file on disk.
6. No database and no localStorage are used for persistent configuration.
7. If the JSON file is missing or invalid, the app safely falls back to env defaults.

## How Ahead/Behind Is Computed

1. Determine active cycle from `resetDay + resetHour + timezone`.
2. Build a simple 7-slot cumulative weekly projection using `simpleDailyIncrement`.
3. For each usage bucket in the cycle, accumulate real Anthropic usage units.
4. Find current slot in the active cycle.
5. Expected checkpoint = projected cumulative value for that slot.
6. Actual checkpoint = cumulative real usage for that slot.
7. Delta = `actual - expected`.
8. Status:
   - `actual > expected` => ahead
   - `actual < expected` => behind
   - `actual === expected` => on track

The UI explicitly notes the integer pacing behavior where `14 * 7 = 98`, so a 100 target can intentionally end at 98 in simple mode.

## What to Customize

1. `config/settings.json`: reset day/hour, timezone, target, increment, default bucket width.
2. Dashboard visuals and card/charts layout in `components/dashboard/dashboard-client.tsx`.
3. Anthropic endpoint behavior and retries in `lib/anthropic-admin.ts`.
4. Pacing logic in `lib/pacing.ts`.
5. Server validation behavior in `app/api/settings/route.ts`.

## Notes

- All Anthropic API calls are server-side only.
- `x-api-key` and `anthropic-version` headers are applied in `lib/anthropic-admin.ts`.
- Pagination (`has_more`, `next_page`) is handled automatically.
- Route responses include cache headers and helper-level retry/cache behavior.
