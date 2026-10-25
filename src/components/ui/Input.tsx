"use client";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { CONTROL, CONTROL_HEIGHT } from "./control";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className = "", ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy: string[] = [];
  if (hint && !error) describedBy.push(`${inputId}-hint`);
  if (error) describedBy.push(`${inputId}-error`);

  const inputClasses = [
    CONTROL,
    CONTROL_HEIGHT,
    "w-full px-3",
    error ? "border-destructive" : "border-border",
    className,
  ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length ? describedBy.join(" ") : undefined}
        className={inputClasses}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
