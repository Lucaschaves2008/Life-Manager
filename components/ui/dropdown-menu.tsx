"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[190px] rounded-[12px] border border-stroke bg-elevated p-1.5 shadow-[0_16px_48px_rgba(0,0,0,.5)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className
        )}
        style={{
          animationDuration: "220ms",
          animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
        }}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13.5px] outline-none transition-colors",
        destructive
          ? "text-coral data-[highlighted]:bg-coral-soft"
          : "text-ice data-[highlighted]:bg-surface-2",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("mx-1 my-1 h-px bg-stroke", className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("microlabel px-3 pb-1 pt-2", className)}
      {...props}
    />
  );
}
