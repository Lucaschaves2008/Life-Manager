import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9.5 w-full rounded-[14px] border border-stroke bg-surface-2 px-3.5 text-[13.5px] text-ice placeholder:text-steel",
        "transition-colors duration-200 focus:border-[rgba(13,110,253,.4)] focus:outline-none",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-[14px] border border-stroke bg-surface-2 px-3.5 py-2.5 text-[13.5px] text-ice placeholder:text-steel",
        "transition-colors duration-200 focus:border-[rgba(13,110,253,.4)] focus:outline-none",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[12.5px] text-mist", className)}
      {...props}
    />
  );
}
