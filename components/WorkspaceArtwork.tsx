import Image from "next/image";

/** Brand illustration, independent of real workflow/worker state. */
export function WorkspaceArtwork({
  variant = "workflows",
  className = "",
}: {
  variant?: "workflows" | "agents";
  className?: string;
}) {
  return (
    <figure className={`m4m-workspace-artwork ${className}`} aria-hidden="true">
      <div className="m4m-artwork-orbit" />
      <Image
        src={`/illustrations/${variant === "agents" ? "agent-core" : "routing-desk"}.svg`}
        width={560}
        height={260}
        loading="eager"
        alt=""
        draggable={false}
        className="m4m-artwork-image"
      />
      <svg viewBox="0 0 560 260" className="m4m-artwork-signals" fill="none">
        {variant === "agents" ? (
          <>
            <path
              d="m139 154 100-34"
              className="m4m-artwork-signal"
              pathLength="100"
            />
            <path
              d="m326 162 65 29"
              className="m4m-artwork-signal is-secondary"
              pathLength="100"
            />
          </>
        ) : (
          <>
            <path
              d="m151 134 69 28 82-26 43 18 67-22"
              className="m4m-artwork-signal"
              pathLength="100"
            />
            <path
              d="m302 136 17-55 75 31"
              className="m4m-artwork-signal is-secondary"
              pathLength="100"
            />
          </>
        )}
      </svg>
      <span className="m4m-artwork-caption">
        {variant === "agents"
          ? "MODEL / INSTRUCTIONS / TOOLS"
          : "TRIGGER / PROCESS / ACTION"}
      </span>
    </figure>
  );
}
