"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/**
 * Sheet lateral (criar/editar registros) — desliza da direita, por padrão.
 * `side="bottom"` vira bottom sheet mobile (drag handle, entra de baixo,
 * altura máx. 85dvh) — mesmo componente, mesma API, só a borda muda de lado.
 */
export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "bottom" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        translate="no"
        className={cn(
          "notranslate fixed z-50 flex flex-col",
          "border-stroke bg-surface shadow-[0_16px_48px_rgba(0,0,0,.5)]",
          side === "right" &&
            cn(
              "inset-y-0 right-0 w-full max-w-[460px] border-l",
              "data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.16,1,0.3,1)]"
            ),
          side === "bottom" &&
            cn(
              "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[20px] border-t",
              "pb-[var(--safe-bottom)]",
              "data-[state=open]:animate-[sheet-in-bottom_260ms_cubic-bezier(0.16,1,0.3,1)]"
            ),
          className
        )}
        {...props}
      >
        {side === "bottom" && (
          <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
            <div className="h-1 w-9 rounded-full bg-stroke" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-steel transition-colors hover:bg-surface-2 hover:text-ice"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({
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

export function SheetDescription({
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
