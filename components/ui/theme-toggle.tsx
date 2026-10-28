"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";
function readTheme(): Theme {
  try {
    const value = localStorage.getItem("agentforge-theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
function snapshot() {
  const theme = readTheme();
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return `${theme}:${dark ? "dark" : "light"}`;
}
function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    document.documentElement.classList.toggle(
      "dark",
      snapshot().endsWith(":dark"),
    );
    onChange();
  };
  window.addEventListener("agentforge-theme-change", sync);
  window.addEventListener("storage", sync);
  media.addEventListener("change", sync);
  return () => {
    window.removeEventListener("agentforge-theme-change", sync);
    window.removeEventListener("storage", sync);
    media.removeEventListener("change", sync);
  };
}

export function ThemeToggle() {
  const current = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system:light",
  );
  const theme = current.split(":")[0] as Theme;
  const next: Theme =
    theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  function toggle() {
    const dark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("agentforge-theme", next);
    } catch {
      /* Keep the theme usable when storage is restricted. */
    }
    window.dispatchEvent(new Event("agentforge-theme-change"));
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${theme}`}
    >
      {theme === "system" ? <Monitor /> : theme === "dark" ? <Moon /> : <Sun />}
    </Button>
  );
}
