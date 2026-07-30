"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const CommandDialog = DialogPrimitive.Root;

export function CommandDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/60",
          "data-[state=open]:animate-[fade-in_240ms_cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=closed]:animate-[fade-out_180ms_cubic-bezier(0.16,1,0.3,1)]"
        )}
        style={{ backdropFilter: "blur(3px)" }}
      />
      <DialogPrimitive.Content
        translate="no"
        aria-describedby={undefined}
        className={cn(
          "group/dialog notranslate fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]",
          "outline-none",
          "data-[state=open]:animate-[fade-in_200ms_cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=closed]:animate-[fade-out_150ms_cubic-bezier(0.16,1,0.3,1)]"
        )}
      >
        <div
          className={cn(
            "relative w-full max-w-[560px] origin-top overflow-hidden",
            "rounded-[16px] border border-stroke bg-elevated shadow-[0_16px_48px_rgba(0,0,0,.5)]",
            "group-data-[state=open]/dialog:animate-[dialog-in_220ms_cubic-bezier(0.16,1,0.3,1)]",
            "group-data-[state=closed]/dialog:animate-[dialog-out_140ms_cubic-bezier(0.16,1,0.3,1)]",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function CommandRoot({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn("flex w-full flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2.5 border-b border-stroke px-4">
      <Search className="h-4 w-4 shrink-0 text-steel" strokeWidth={1.5} />
      <CommandPrimitive.Input
        className={cn(
          "h-12 w-full bg-transparent text-[14px] text-paper placeholder:text-steel outline-none",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[60vh] overflow-y-auto p-2", className)}
      {...props}
    />
  );
}

export function CommandEmpty(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>
) {
  return (
    <CommandPrimitive.Empty
      className="py-8 text-center text-[13px] text-mist"
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "[&_[cmdk-group-heading]]:microlabel [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:!text-[10px]",
        className
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-[13.5px] text-mist transition-colors",
        "data-[selected=true]:bg-surface-2 data-[selected=true]:text-ice",
        className
      )}
      {...props}
    />
  );
}
