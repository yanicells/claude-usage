"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "claudium-timer-tracker-v1";
const MINUTES_PER_DAY = 24 * 60;
const STEP_MINUTES = 15;
const RESET_GAP_MINUTES = 5 * 60;
const RESET_COUNT = 4;

const DEFAULT_START_MINUTE = 9 * 60;
const DEFAULT_RESET_OFFSETS = Array.from(
  { length: RESET_COUNT },
  (_, index) => (index + 1) * RESET_GAP_MINUTES,
);

type StoredTimerTracker = {
  startMinute: number;
  resetOffsets: number[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundToStep(minutes: number): number {
  return Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
}

function formatClockTime(minute: number): string {
  const normalized =
    ((Math.round(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  if (mins === 0) {
    return `${hour12} ${period}`;
  }

  return `${hour12}:${String(mins).padStart(2, "0")} ${period}`;
}

function normalizeStored(raw: string | null): StoredTimerTracker | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTimerTracker>;
    if (!Number.isFinite(parsed.startMinute) || !parsed.resetOffsets) {
      return null;
    }

    const resetOffsets = DEFAULT_RESET_OFFSETS.map((fallback, index) => {
      const candidate = parsed.resetOffsets?.[index];
      return Number.isFinite(candidate) ? Number(candidate) : fallback;
    });

    return {
      startMinute: clamp(
        roundToStep(Number(parsed.startMinute)),
        0,
        MINUTES_PER_DAY - STEP_MINUTES,
      ),
      resetOffsets: constrainOffsets(resetOffsets),
    };
  } catch {
    return null;
  }
}

function getOffsetBounds(offsets: number[], index: number) {
  const previous = index === 0 ? 0 : offsets[index - 1];
  const remainingHandles = RESET_COUNT - index - 1;

  return {
    min: previous + RESET_GAP_MINUTES,
    max: MINUTES_PER_DAY - remainingHandles * RESET_GAP_MINUTES,
  };
}

function constrainOffsets(offsets: number[]): number[] {
  const next = DEFAULT_RESET_OFFSETS.map((fallback, index) => {
    const candidate = offsets[index];
    return Number.isFinite(candidate) ? roundToStep(candidate) : fallback;
  });

  for (let index = 0; index < RESET_COUNT; index += 1) {
    const { min, max } = getOffsetBounds(next, index);
    next[index] = clamp(next[index], min, max);
  }

  for (let index = RESET_COUNT - 2; index >= 0; index -= 1) {
    next[index] = Math.min(next[index], next[index + 1] - RESET_GAP_MINUTES);
  }

  return next;
}

function moveOffset(offsets: number[], index: number, rawMinute: number): number[] {
  const next = [...offsets];
  const { min, max } = getOffsetBounds(next, index);
  next[index] = clamp(roundToStep(rawMinute), min, max);

  for (let i = index + 1; i < RESET_COUNT; i += 1) {
    next[i] = Math.max(next[i], next[i - 1] + RESET_GAP_MINUTES);
  }

  for (let i = index - 1; i >= 0; i -= 1) {
    next[i] = Math.min(next[i], next[i + 1] - RESET_GAP_MINUTES);
  }

  return constrainOffsets(next);
}

function getOffsetFromClientX(clientX: number, track: HTMLDivElement): number {
  const rect = track.getBoundingClientRect();
  const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
  return percent * MINUTES_PER_DAY;
}

export function TimerTracker() {
  const startSliderId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [startMinute, setStartMinute] = useState(DEFAULT_START_MINUTE);
  const [resetOffsets, setResetOffsets] = useState(DEFAULT_RESET_OFFSETS);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = normalizeStored(window.localStorage.getItem(STORAGE_KEY));
      if (stored) {
        setStartMinute(stored.startMinute);
        setResetOffsets(stored.resetOffsets);
      }
      setHasLoaded(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startMinute, resetOffsets }),
    );
  }, [hasLoaded, resetOffsets, startMinute]);

  const resetMarkers = useMemo(
    () =>
      resetOffsets.map((offset, index) => ({
        index,
        offset,
        left: (offset / MINUTES_PER_DAY) * 100,
        label: formatClockTime(startMinute + offset),
      })),
    [resetOffsets, startMinute],
  );

  function handleResetPointer(
    index: number,
    clientX: number,
    target?: EventTarget | null,
    pointerId?: number,
  ): void {
    const track = trackRef.current;
    if (!track) return;

    if (
      target instanceof HTMLElement &&
      pointerId !== undefined &&
      typeof target.setPointerCapture === "function"
    ) {
      target.setPointerCapture(pointerId);
    }

    const offset = getOffsetFromClientX(clientX, track);
    setResetOffsets((current) => moveOffset(current, index, offset));
  }

  function handleResetKeyDown(
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
    const pageDirection = event.key === "PageDown" ? -1 : 1;

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      setResetOffsets((current) =>
        moveOffset(current, index, current[index] + direction * STEP_MINUTES),
      );
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setResetOffsets((current) =>
        moveOffset(current, index, current[index] + pageDirection * 60),
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setResetOffsets((current) => {
        const { min, max } = getOffsetBounds(current, index);
        return moveOffset(current, index, event.key === "Home" ? min : max);
      });
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-ctp-surface1 bg-ctp-surface0 p-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-base font-semibold text-ctp-subtext0">5h tracker</p>
        <p className="text-xl leading-none font-bold text-ctp-text tabular-nums">
          {formatClockTime(startMinute)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={startSliderId}>
          Start time
        </label>
        <input
          id={startSliderId}
          type="range"
          min={0}
          max={MINUTES_PER_DAY - STEP_MINUTES}
          step={STEP_MINUTES}
          value={startMinute}
          onChange={(event) => setStartMinute(Number(event.target.value))}
          className="timer-clock-range"
          aria-valuetext={formatClockTime(startMinute)}
        />
        <div className="flex justify-between text-[0.68rem] text-ctp-overlay0 tabular-nums">
          <span>12 am</span>
          <span>12 pm</span>
          <span>12 am</span>
        </div>
      </div>

      <div className="pt-2">
        <div ref={trackRef} className="relative h-20">
          <div className="absolute top-7 right-0 left-0 h-1.5 rounded-full bg-ctp-surface1">
            <div className="h-full rounded-full bg-ctp-blue/35" />
          </div>

          <div className="absolute top-[1.28rem] left-0 z-10 h-5 w-5 -translate-x-1 rounded-full border-2 border-ctp-surface0 bg-ctp-green shadow-[0_0_0_1px_rgba(166,227,161,0.45)]" />
          <div className="absolute top-12 left-0 text-xs leading-none font-semibold text-ctp-green tabular-nums">
            {formatClockTime(startMinute)}
          </div>

          {resetMarkers.map((marker) => {
            const { min, max } = getOffsetBounds(resetOffsets, marker.index);

            return (
              <button
                key={marker.index}
                type="button"
                role="slider"
                aria-label={`Reset ${marker.index + 1}`}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={marker.offset}
                aria-valuetext={marker.label}
                onKeyDown={(event) => handleResetKeyDown(marker.index, event)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleResetPointer(
                    marker.index,
                    event.clientX,
                    event.currentTarget,
                    event.pointerId,
                  );
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                    return;
                  }
                  handleResetPointer(marker.index, event.clientX);
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                className="absolute top-[1.12rem] z-20 h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-ctp-surface0 bg-ctp-yellow shadow-[0_0_0_1px_rgba(249,226,175,0.42)] outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-surface0 active:cursor-grabbing"
                style={{ left: `${marker.left}%` }}
              >
                <span className="sr-only">{marker.label}</span>
              </button>
            );
          })}

          {resetMarkers.map((marker) => (
            <span
              key={`label-${marker.index}`}
              className="absolute top-12 -translate-x-1/2 text-xs leading-none font-semibold text-ctp-yellow tabular-nums"
              style={{ left: `${marker.left}%` }}
            >
              {marker.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
