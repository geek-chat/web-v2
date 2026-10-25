import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ButtonBase } from "@/components/ui/ButtonBase";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";

const VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const;
const SIZES = ["sm", "md", "lg"] as const;

/**
 * Every ui primitive in its variants and states, to compare them side by side
 * after a change (`npm run dev`, then /dev/ui). Development only: production
 * answers 404. The labels name the props they show, so they stay out of i18n.
 */
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <h1 className="text-xl font-semibold">ui</h1>

      <Section title="Button">
        {VARIANTS.map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {variant} {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              disabled
            </Button>
            <Button variant={variant} loading>
              loading
            </Button>
          </div>
        ))}
      </Section>

      <Section title="ButtonBase: no look of its own, shaped by the caller (Tab shows the focus ring)">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonBase className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-border/40">chip ×</ButtonBase>
          <ButtonBase className="rounded-sm text-xs text-destructive underline underline-offset-2">inline link</ButtonBase>
        </div>
      </Section>

      <Section title="Input, Select, Textarea">
        <Input label="label" hint="hint" placeholder="placeholder" />
        <Input label="error" error="error message" defaultValue="value" />
        <Input label="disabled" disabled defaultValue="value" />
        <div className="flex flex-wrap gap-2">
          <Select aria-label="select" defaultValue="a">
            <option value="a">option a</option>
            <option value="b">option b, a longer one</option>
          </Select>
          <Select aria-label="select disabled" disabled defaultValue="a">
            <option value="a">disabled</option>
          </Select>
        </div>
        <Textarea aria-label="textarea" rows={3} placeholder="placeholder" />
      </Section>

      <Section title="One row: single-line controls and a md Button are all h-10">
        <div className="flex items-start gap-2">
          <Select aria-label="row select" defaultValue="0" className="shrink-0">
            <option value="0">select</option>
          </Select>
          <Input aria-label="row input" placeholder="input" className="min-w-0 flex-1" />
          <Button>button</Button>
        </div>
      </Section>

      <Section title="Avatar, Spinner">
        <div className="flex items-center gap-3">
          <Avatar nickname="Alice" size="sm" />
          <Avatar nickname="Bob" size="md" />
          <Avatar nickname="Carol" size="lg" />
          <Spinner />
          <Spinner label="label" />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
