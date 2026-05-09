"use client";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export function Spinner({ size = 16, label, className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 text-muted-foreground ${className}`}
    >
      <Loader2 width={size} height={size} className="animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">불러오는 중</span>}
    </span>
  );
}
