"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AutoHeight } from "@animate-ui/react/primitives/effects/auto-height";
import { PaletteIcon } from "lucide-react";
import {
  companyBrandingFormSchema,
  startingColorFor,
  type CompanyBrandingFormInput,
} from "@repo/shared";
import { updateCompanySettings } from "@/app/actions/companies";
import { applyActionFailure } from "@/components/forms/apply-action-failure";
import type { MyCompany } from "@/lib/dal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HexColorPicker } from "@/components/ui/color-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "./initials";

/**
 * The overview's invitation to brand the company. It shows while the company has no brand color and
 * the viewer can change company settings, and leaves by itself once a color is saved (there is
 * deliberately no dismiss). "Brand it" opens the card in place: a color picker and the logo link
 * on one side, a miniature of the public page on the other, recoloured as you drag.
 *
 * Motion is Animate UI's: `AutoHeight` grows the card (dist/primitives/effects/auto-height), the
 * body fades in over 300 ms and out over 150 ms with a 12 px shift and `ease.out` (the panel
 * timings copied in `screening-rules-editor.tsx`), and the card leaves with the same fade plus a
 * height collapse. Nothing moves under `prefers-reduced-motion`.
 */
export function BrandingCard({ company }: { company: MyCompany }) {
  // Mirrors CompanyPolicy.update in the API, which enforces it anyway (403); the same check as company-settings-form.tsx.
  const canEdit = company.role === "owner" || company.role === "admin";
  const show = canEdit && company.brandColor === null;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const panel = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 12 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : 0.3,
        ease: [0.23, 1, 0.32, 1] as const,
      },
    },
    exit: {
      opacity: 0,
      y: reduceMotion ? 0 : -12,
      transition: {
        duration: reduceMotion ? 0 : 0.15,
        ease: [0.4, 0, 1, 1] as const,
      },
    },
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="branding-card"
          initial={false}
          exit={{
            opacity: 0,
            height: 0,
            transition: {
              duration: reduceMotion ? 0 : 0.3,
              ease: [0.4, 0, 0.1, 1] as const,
            },
          }}
          // Both this wrapper and AutoHeight clip their children (overflow: hidden, for the height animation), so the
          // room the card's shadow needs is added in three matching steps: p-3 here, -m-3 on AutoHeight and p-3 on
          // the measured div inside it. Margins and paddings cancel, so the card keeps its place in the layout.
          className="-m-3 overflow-hidden p-3"
        >
          <AutoHeight className="-m-3">
            <div className="p-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PaletteIcon className="size-4" />
                    Make it yours
                  </CardTitle>
                  <CardDescription>
                    Pick a brand color and a logo. Candidates see them on your
                    job pages.
                  </CardDescription>
                </CardHeader>
                <AnimatePresence initial={false} mode="popLayout">
                  {open ? (
                    <motion.div
                      key="body"
                      {...panel}
                      className="px-(--card-spacing)"
                    >
                      <BrandingBody
                        company={company}
                        onCancel={() => setOpen(false)}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="cta"
                      {...panel}
                      className="px-(--card-spacing)"
                    >
                      <Button onClick={() => setOpen(true)}>Brand it</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </div>
          </AutoHeight>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrandingBody({
  company,
  onCancel,
}: {
  company: MyCompany;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const form = useForm<CompanyBrandingFormInput>({
    resolver: zodResolver(companyBrandingFormSchema),
    // mode: the logo link is checked as you type, so the preview never tries a bad link.
    mode: "onChange",
    defaultValues: { logoUrl: company.logoUrl ?? "", brandColor: "" },
  });
  const [logoUrl, brandColor] = useWatch({
    control: form.control,
    name: ["logoUrl", "brandColor"],
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CompanyBrandingFormInput) {
    setFormError(undefined);
    try {
      const result = await updateCompanySettings(company.slug, {
        name: company.name,
        ...values,
      });
      // On success the action revalidates the layout, the page re-renders with the saved color and the card above leaves.
      if (!result.saved) {
        setFormError(applyActionFailure(form, result));
      }
    } catch {
      // The action returns API failures, but a dropped connection or a server error still throws.
      setFormError(
        "We couldn't save your branding. Check your connection and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-6 pb-1 md:grid-cols-2"
    >
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Controller
          name="brandColor"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="branding-card-color">Brand color</FieldLabel>
              <HexColorPicker
                value={field.value}
                fallback={startingColorFor(company.name)}
                onChange={(hex) => field.onChange(hex)}
              />
              <Input
                {...field}
                id="branding-card-color"
                placeholder="#1a73e8"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="logoUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="branding-card-logo">Logo link</FieldLabel>
              <Input
                {...field}
                id="branding-card-logo"
                aria-describedby="branding-card-logo-description"
                type="url"
                placeholder="https://example.com/logo.png"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription id="branding-card-logo-description">
                Optional. A link to an image on https://.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex items-center gap-2">
          {/* No color yet means nothing to save: the card is for the color, the logo is the extra. */}
          <Button
            type="submit"
            disabled={isSubmitting || !brandColor || Boolean(errors.brandColor)}
          >
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Save branding
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </FieldGroup>

      <BrandingPreview
        name={company.name}
        brandColor={brandColor && !errors.brandColor ? brandColor : ""}
        logoUrl={logoUrl && !errors.logoUrl ? logoUrl : ""}
      />
    </form>
  );
}

/**
 * Miniatures of the company's public job pages, one per theme: the brand color backs the page and a
 * card carries the logo, the name and a couple of jobs. The brand color is the same in both, only the
 * card surface follows the theme. Each miniature sits in a `.light` or `.dark` island, which
 * re-declares the color tokens (`globals.css`), so both show whatever theme the dashboard is in.
 * No text sits on the brand color, so it needs no contrast math (the real pages compute a readable
 * text color on the server, `lib/brand.ts`). Purely decorative, so it is hidden from assistive
 * technology.
 */
function BrandingPreview({
  name,
  brandColor,
  logoUrl,
}: {
  name: string;
  brandColor: string;
  logoUrl: string;
}) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <p className="text-xs text-muted-foreground">
        How your job pages will look
      </p>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme} className="flex flex-col gap-1.5">
            <span className="text-xs capitalize text-muted-foreground">
              {theme}
            </span>
            <div
              className={`${theme} flex flex-1 flex-col justify-center rounded-2xl bg-muted/30 p-3 text-foreground ring-1 ring-foreground/5 transition-colors duration-150 ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none dark:ring-foreground/10`}
              style={brandColor ? { backgroundColor: brandColor } : undefined}
            >
              <div className="flex flex-col gap-3 rounded-xl bg-card p-3 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    {logoUrl && <AvatarImage src={logoUrl} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs font-medium">{name}</span>
                </div>
                {[0, 1].map((row) => (
                  <div
                    key={row}
                    className="flex flex-col gap-1.5 rounded-lg border p-2"
                  >
                    <div className="h-2 w-2/3 rounded-full bg-muted" />
                    <div className="h-1.5 w-1/3 rounded-full bg-muted/60" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
