"use client";

import { useId, useSyncExternalStore } from "react";
import { Pause, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "m4m-motion";
const CHANGE_EVENT = "m4m-motion-change";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

type MotionPreference = "on" | "off";

// Retain the current choice even when the browser disallows localStorage.
let sessionPreference: MotionPreference | null = null;

function readPreference(): MotionPreference {
  if (sessionPreference) return sessionPreference;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

function snapshot() {
  const reduced = window.matchMedia(REDUCED_MOTION).matches;
  return `${readPreference()}:${reduced ? "reduced" : "full"}`;
}

function applyMotionPreference() {
  const enabled =
    readPreference() === "on" && !window.matchMedia(REDUCED_MOTION).matches;
  document.documentElement.dataset.motion = enabled ? "on" : "off";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION);
  const sync = () => {
    applyMotionPreference();
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    sessionPreference = null;
    sync();
  };

  window.addEventListener(CHANGE_EVENT, sync);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", sync);
  applyMotionPreference();

  return () => {
    window.removeEventListener(CHANGE_EVENT, sync);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", sync);
  };
}

export function MotionToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const current = useSyncExternalStore(subscribe, snapshot, () => "on:full");
  const descriptionId = useId();
  const reduced = current.endsWith(":reduced");
  const paused = current.startsWith("off:") || reduced;
  const label = paused ? "Enable animations" : "Pause animations";

  function toggle() {
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    const next: MotionPreference = readPreference() === "off" ? "on" : "off";
    sessionPreference = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The current session still reflects the selected preference.
    }
    applyMotionPreference();
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className={cn("forge-nav-item m4m-motion-toggle", className)}
      onClick={toggle}
      disabled={reduced}
      aria-label={label}
      aria-describedby={reduced ? descriptionId : undefined}
      title={label}
      data-state={paused ? "paused" : "active"}
    >
      {paused ? (
        <Pause size={16} aria-hidden="true" />
      ) : (
        <Waves size={16} aria-hidden="true" />
      )}
      {!compact && (
        <span className="m4m-nav-label">
          {paused ? "Animations off" : "Animations on"}
        </span>
      )}
      {reduced && (
        <span id={descriptionId} className="sr-only">
          Animations are paused by your system’s reduced motion setting.
        </span>
      )}
    </button>
  );
}
