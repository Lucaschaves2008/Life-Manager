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
        className={cn(
          "fixed inset-0 z-50 bg-black/60",
          "data-[state=open]:animate-[fade-in_240ms_cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=closed]:animate-[fade-out_180ms_cubic-bezier(0.16,1,0.3,1)]"
        )}
        style={{ backdropFilter: "blur(3px)" }}
      />
      {/* Wrapper: só centraliza (flex). Não anima — evita o transform "puxando" do canto. */}
      <DialogPrimitive.Content
        translate="no"
        aria-describedby={undefined}
        className={cn(
          "group/dialog notranslate fixed inset-0 z-50 flex items-center justify-center p-4",
          "outline-none",
          "data-[state=open]:animate-[fade-in_200ms_cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=closed]:animate-[fade-out_150ms_cubic-bezier(0.16,1,0.3,1)]"
        )}
      >
        {/* Painel: anima só escala + opacidade, a partir do próprio centro. */}
        <div
          className={cn(
            "relative w-full max-w-lg origin-center will-change-transform",
            "rounded-[20px] border border-stroke bg-elevated p-6 shadow-[0_16px_48px_rgba(0,0,0,.5)]",
            "group-data-[state=open]/dialog:animate-[dialog-in_260ms_cubic-bezier(0.16,1,0.3,1)]",
            "group-data-[state=closed]/dialog:animate-[dialog-out_160ms_cubic-bezier(0.16,1,0.3,1)]",
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
        </div>
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
