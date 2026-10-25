/**
 * The one look of a form control. Input, Select and Textarea all start from
 * these classes, so text, border, focus ring and the disabled state cannot
 * drift between screens. (The two TTL dropdowns once styled themselves: px-2
 * in one, px-3 without text-sm in the other, the arrow against the border in
 * both.) Each control adds its own border color, padding and height.
 */
export const CONTROL = [
  "rounded-md border bg-background text-sm text-foreground",
  "placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/** The height of a single-line control (Input, Select), level with a md Button. */
export const CONTROL_HEIGHT = "h-10";
