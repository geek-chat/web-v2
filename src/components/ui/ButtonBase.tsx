"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { FOCUS_RING } from "./control";

/**
 * A <button> with what every button shares and no look of its own:
 * type="button" unless told otherwise (a bare <button> inside a form submits
 * it), the focus ring, and the not-allowed cursor while disabled. Button
 * builds on it. Use it directly for a shape Button's variants do not fit:
 * a list row, a chip, an inline link.
 */
export const ButtonBase = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function ButtonBase({ type, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(FOCUS_RING, "disabled:cursor-not-allowed", className)}
        {...rest}
      />
    );
  },
);
