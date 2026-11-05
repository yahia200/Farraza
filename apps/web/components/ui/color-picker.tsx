"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { Slider } from "@animate-ui/react/primitives/base-ui/slider";
import { spring } from "@animate-ui/react/utils/motion";
import { clampNumber, hexToHsv, hsvToHex, isHexColor, type Hsv } from "@repo/shared";
import { cn } from "@/lib/utils";

/*
 * A color picker: a saturation/brightness square with a draggable circle, and a hue strip under
 * it. shadcn has no color picker, so it is built here from two pieces and styled like shadcn's
 * Slider (rounded track, white thumb with a ring that grows on hover and focus):
 *   - the hue strip is Animate UI's Base UI Slider (keyboard, drag and motion for free;
 *     node_modules/@animate-ui/react/dist/primitives/base-ui/slider, Base UI docs/react/components/slider.md);
 *   - the square is a pointer-capture drag with arrow-key support, because Base UI's Slider is
 *     one-dimensional. The circle follows the pointer directly (no lag), and only its press
 *     scale uses Animate UI's `spring.press` (dist/utils/motion).
 * The color math (HSV <-> #rrggbb) is in @repo/shared `color.ts`, where it is tested.
 */

const HUE_GRADIENT =
  "linear-gradient(to right, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)";
const SQUARE_GRADIENT =
  "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)";

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

function SaturationValueSquare({
  value,
  onChange,
  disabled,
}: {
  value: Hsv;
  onChange: (next: Hsv) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const squareRef = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState(false);

  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = squareRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    onChange({
      h: value.h,
      s: clampNumber((event.clientX - rect.left) / rect.width, 0, 1),
      v: 1 - clampNumber((event.clientY - rect.top) / rect.height, 0, 1),
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
    pick(event);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setPressed(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const arrow = ARROWS[event.key];
    if (disabled || !arrow) return;
    event.preventDefault();
    // 1% per press, 10% with Shift (the same steps as a native range input's arrow and page keys).
    const step = event.shiftKey ? 0.1 : 0.01;
    onChange({
      h: value.h,
      s: clampNumber(value.s + arrow[0] * step, 0, 1),
      v: clampNumber(value.v + arrow[1] * step, 0, 1),
    });
  }

  return (
    <div
      ref={squareRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value.s * 100)}
      aria-valuetext={`Saturation ${Math.round(value.s * 100)}%, brightness ${Math.round(value.v * 100)}%`}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      data-slot="color-picker-square"
      className={cn(
        "relative h-40 w-full cursor-crosshair touch-none rounded-2xl select-none",
        "ring-1 ring-black/10 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-hidden",
        disabled && "pointer-events-none opacity-50",
      )}
      style={{
        backgroundColor: hsvToHex({ h: value.h, s: 1, v: 1 }),
        backgroundImage: SQUARE_GRADIENT,
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute size-5 rounded-full border-2 border-white shadow-md ring-1 ring-black/10"
        style={{
          left: `${value.s * 100}%`,
          top: `${(1 - value.v) * 100}%`,
          x: "-50%",
          y: "-50%",
          backgroundColor: hsvToHex(value),
        }}
        animate={{ scale: pressed ? 1.25 : 1 }}
        transition={reduceMotion ? { duration: 0 } : spring.press}
      />
    </div>
  );
}

function HueStrip({
  hue,
  onChange,
  disabled,
}: {
  hue: number;
  onChange: (hue: number) => void;
  disabled?: boolean;
}) {
  return (
    <Slider.Root
      value={hue}
      min={0}
      max={360}
      step={1}
      thumbAlignment="edge"
      disabled={disabled}
      onValueChange={(next) =>
        onChange(typeof next === "number" ? next : (next[0] ?? hue))
      }
      data-slot="color-picker-hue"
      className="w-full"
      style={
        { "--hue-color": hsvToHex({ h: hue, s: 1, v: 1 }) } as CSSProperties
      }
    >
      <Slider.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50">
        <Slider.Track
          className="relative h-3 grow rounded-full ring-1 ring-black/10 select-none"
          style={{ backgroundImage: HUE_GRADIENT }}
        />
        <Slider.Thumb
          aria-label="Hue"
          className="block size-5 shrink-0 rounded-full border-2 border-white bg-(--hue-color) shadow-md ring-1 ring-black/10 transition-shadow select-none hover:ring-4 hover:ring-ring/30 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-hidden"
        />
      </Slider.Control>
    </Slider.Root>
  );
}

/** The picker for a color held as HSV. */
export function ColorPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Hsv;
  onChange: (next: Hsv) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="color-picker"
      className={cn("flex w-full flex-col gap-4", className)}
    >
      <SaturationValueSquare
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <HueStrip
        hue={value.h}
        onChange={(h) => onChange({ ...value, h })}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * The picker for a `#rrggbb` string, which is what forms and the database hold. It keeps the HSV
 * itself (a hex string can't remember a hue once the color is grey) and only calls `onChange` when
 * the user moves something, so an unbranded company stays unbranded until the first drag.
 * `fallback` is where the picker starts while `value` is empty.
 */
export function HexColorPicker({
  value,
  fallback,
  onChange,
  disabled,
  className,
}: {
  value: string;
  fallback: Hsv;
  onChange: (hex: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [hsv, setHsv] = useState<Hsv>(() =>
    isHexColor(value) ? hexToHsv(value) : fallback,
  );

  // The hex can change underneath us (typed into the hex box, or "Remove color"). Adopt it, keeping the
  // hue on screen when the new color is a grey. Adjusting state during render is safe here: the
  // second pass finds the two equal and stops (https://react.dev/learn/you-might-not-need-an-effect).
  if (isHexColor(value) && value.toLowerCase() !== hsvToHex(hsv)) {
    setHsv(hexToHsv(value, hsv.h));
  }

  return (
    <ColorPicker
      value={hsv}
      disabled={disabled}
      className={className}
      onChange={(next) => {
        setHsv(next);
        onChange(hsvToHex(next));
      }}
    />
  );
}
