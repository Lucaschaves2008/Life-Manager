"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Checkbox custom (3.5.8): quadrado 18px, raio 6px, check menta. */
export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-stroke bg-surface-2 transition-colors duration-200",
        "data-[state=checked]:border-[rgba(62,224,143,.4)] data-[state=checked]:bg-mint-soft",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3 w-3 text-mint" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
