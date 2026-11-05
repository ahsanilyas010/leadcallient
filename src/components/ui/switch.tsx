"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

// On/off switch. On: solid LeadCallient indigo with a white thumb. Off: an
// outlined track with a grey thumb. Both states keep at least 3:1 contrast
// against the page (WCAG 1.4.11), and position plus colour show the state, so
// it reads the same whatever the colour scheme. Keyboard: Tab to focus,
// Space to toggle; the focus ring is always visible.
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-brand-blue data-[state=checked]:bg-brand-blue",
      "data-[state=unchecked]:border-muted data-[state=unchecked]:bg-surface",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform",
        "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-white",
        "data-[state=unchecked]:translate-x-[2px] data-[state=unchecked]:bg-muted",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
