# Claude Usage Companion

Personal-use dashboard for tracking your Claude usage manually.

This app is intentionally simple and local:

- no database
- no org analytics
- no admin API reporting
- no model/workspace/service-tier filters
- no cost dashboard

Everything is stored in local JSON files and updated with manual snapshots.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Luxon for timezone-aware pacing math

## Run

```bash
pnpm install
pnpm dev
```

Production checks:

```bash
pnpm lint
pnpm build
pnpm start
```

## Local Data Files

### `config/settings.json`

```json
{
  "timezone": "Asia/Manila",
  "weeklyResetDay": "friday",
  "weeklyResetHour": 11,
  "weeklyTargetPercent": 100,
  "simpleDailyIncrement": 14,
  "fiveHourWindowHours": 5,
  "weeklyLimitLabel": "Weekly Claude limit",
  "fiveHourLimitLabel": "5-hour Claude limit"
}
```

### `data/usage-state.json`

```json
{
  "currentFiveHourUsagePercent": 62,
  "currentWeeklyUsagePercent": 37,
  "currentFiveHourWindowStartedAt": "2026-04-07T09:00:00+08:00",
  "currentWeeklyCycleStartedAt": "2026-04-04T11:00:00+08:00",
  "lastUpdatedAt": "2026-04-07T12:30:00+08:00",
  "notes": "Used Claude heavily for coding in the morning"
}
```

### `data/usage-history.json`

```json
{
  "snapshots": [
    {
      "timestamp": "2026-04-07T12:30:00+08:00",
      "fiveHourUsagePercent": 62,
      "weeklyUsagePercent": 37,
      "notes": "Used Claude heavily for coding in the morning"
    }
  ]
}
```

## Core UX

Home page sections:

1. Hero and one-line purpose
2. Current status cards
3. Quick update panel
4. Weekly pacing view
5. Guidance panel
6. Recent snapshots list

Quick update accepts:

- 5-hour usage as percent (`62`) or fraction (`3/5`)
- weekly usage percent
- optional notes
- timestamp
- optional checkbox to start a fresh 5-hour window from the timestamp

## Pacing Logic

The weekly pace uses a simple integer cumulative projection:

- week anchor from `weeklyResetDay + weeklyResetHour + timezone`
- `expected(slot) = min((slot + 1) * simpleDailyIncrement, weeklyTargetPercent)`
- status comparison at current slot:
  - `actual > expected` => ahead
  - `actual < expected` => behind
  - `actual === expected` => on track

Example with reset Friday 11:00 and increment 14:

- Fri 14
- Sat 28
- Sun 42
- Mon 56
- Tue 70
- Wed 84
- Thu 98

## API Endpoints (Local JSON Backed)

- `GET /api/companion` -> load dashboard state and computed guidance
- `POST /api/companion/snapshot` -> save a new manual snapshot to state + history

## Notes

- Files are written atomically with temp-file rename.
- Missing JSON files are auto-created with defaults.
- The app is fully usable without any official Claude personal usage API.
