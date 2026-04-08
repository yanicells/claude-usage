import { ClearIcon, PasteIcon } from "@/components/dashboard/dashboard-icons";

function formatTimeAgo(isoString: string): { relative: string; absolute: string } {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative: string;
  if (diffMins < 1) {
    relative = "just now";
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else {
    relative = `${diffDays}d ago`;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const absolute = formatter.format(then);

  return { relative, absolute };
}

export function DashboardHeader({
  notice,
  onPaste,
  onClear,
  lastPastedTime,
}: {
  notice: string | null;
  onPaste: () => void;
  onClear: () => void;
  lastPastedTime: string | null;
}) {
  const timeInfo = lastPastedTime ? formatTimeAgo(lastPastedTime) : null;

  return (
    <div className="flex items-center border-b border-ctp-surface1 pb-5">
      <span className="text-3xl font-bold tracking-tight text-ctp-text select-none">
        Claudium
      </span>

      {notice ? (
        <span className="ml-5 max-w-xs truncate text-sm text-ctp-subtext0">
          {notice}
        </span>
      ) : null}

      <div className="flex-1" />

      <div className="flex items-center gap-6">
        {timeInfo && (
          <div className="flex flex-col items-end gap-0.5">
            <p className="text-xs leading-none text-ctp-subtext0">
              Last Updated: {timeInfo.relative}
            </p>
            <p className="text-xs leading-none text-ctp-subtext0">
              {timeInfo.absolute}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onPaste}
          className="flex cursor-pointer items-center gap-2 text-2xl font-bold text-ctp-subtext0 transition-colors hover:text-ctp-text"
        >
          <PasteIcon />
          paste
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex cursor-pointer items-center gap-2 text-2xl font-bold text-ctp-overlay0 transition-colors hover:text-ctp-red"
        >
          <ClearIcon />
          clear
        </button>
      </div>
    </div>
  );
}
