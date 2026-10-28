import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("m4m-brand", compact && "is-compact", className)}>
      <span className="m4m-brand-symbol" aria-hidden="true">
        <svg width="25" height="25" viewBox="0 0 32 32" fill="none">
          <path
            d="M7 23V9l9 8 9-8v14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="23" r="3" fill="currentColor" />
          <circle cx="16" cy="17" r="3" fill="currentColor" />
          <circle cx="25" cy="9" r="3" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className="m4m-wordmark">m8m</span>}
    </span>
  );
}
