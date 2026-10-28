"use client";
import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";

export function SecretInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="m4m-secret-input">
      <Input
        {...props}
        className={className}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        aria-label={visible ? "Hide secret" : "Show secret"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
