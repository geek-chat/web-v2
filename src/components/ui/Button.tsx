"use client";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

// Hover only on enabled buttons, so a disabled one (an empty message box's
// send button) does not light up as if it could be pressed.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground enabled:hover:bg-primary-hover disabled:opacity-50",
  secondary:
    "bg-muted text-foreground border border-border enabled:hover:bg-border enabled:hover:border-muted-foreground/50 disabled:opacity-50",
  ghost: "text-foreground enabled:hover:bg-border disabled:opacity-50",
  destructive:
    "bg-destructive text-white enabled:hover:opacity-80 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    className = "",
    children,
    type,
    ...rest
  },
  ref,
) {
  // cn lets a caller's className (a brand color, say) replace the variant's.
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
