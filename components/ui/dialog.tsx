"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[fade-in_220ms_cubic-bezier(0.16,1,0.3,1)]"
        style={{ backdropFilter: "blur(2px)" }}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-[20px] border border-stroke bg-elevated p-6 shadow-[0_16px_48px_rgba(0,0,0,.5)]",
          "data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.16,1,0.3,1)]",
          "max-h-[85vh] overflow-y-auto",
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("display text-[24px] text-paper", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-[13px] text-mist", className)}
      {...props}
    />
  );
}
