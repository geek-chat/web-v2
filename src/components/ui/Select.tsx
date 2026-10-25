"use client";
import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CONTROL, CONTROL_HEIGHT } from "./control";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Layout of the outer box (width, flex), not the control's look. */
  className?: string;
}

/**
 * A native <select> in the control look. The browser's own arrow is switched
 * off (appearance-none) and an icon is drawn inside reserved right padding, so
 * the arrow never touches the border and the text never runs under it.
 * Native on purpose: phones open their own picker, and keyboards and screen
 * readers need no extra code.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        ref={ref}
        className={cn(CONTROL, CONTROL_HEIGHT, "peer w-full appearance-none border-border pl-3 pr-9")}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50"
      />
    </span>
  );
});
