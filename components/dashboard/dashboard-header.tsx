import { ClearIcon, PasteIcon } from "@/components/dashboard/dashboard-icons";

export function DashboardHeader({
  notice,
  onPaste,
  onClear,
}: {
  notice: string | null;
  onPaste: () => void;
  onClear: () => void;
}) {
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
