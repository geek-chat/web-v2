"use client";
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { CONTROL } from "./control";

/** A <textarea> in the control look. Its height comes from `rows` and the caller's min and max. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={[CONTROL, "border-border px-3 py-2", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);
