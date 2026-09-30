"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  label?: string;
}

export function Slider({ min, max, step = 0.1, value, onChange, className, label }: SliderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        aria-label={label}
      />
      <span className="text-sm font-mono w-10 text-right text-muted-foreground">{value}</span>
    </div>
  );
}
