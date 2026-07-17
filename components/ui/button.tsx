import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline" | "dashed" | "danger" | "soft";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-mint text-[#05270f] font-medium hover:brightness-110 active:brightness-95",
  soft: "bg-mint-soft text-mint border border-[rgba(62,224,143,.25)] hover:bg-[rgba(62,224,143,.18)]",
  ghost: "text-mist hover:bg-surface-2 hover:text-ice",
  outline:
    "border border-stroke text-ice bg-transparent hover:border-[rgba(143,169,205,.22)] hover:bg-surface-2/50",
  dashed:
    "border border-dashed border-stroke text-mist hover:border-mint hover:text-mint",
  danger: "bg-coral-soft text-coral border border-[rgba(255,107,107,.25)] hover:bg-[rgba(255,107,107,.18)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-9.5 px-4.5 text-[13.5px] gap-2",
  icon: "h-9 w-9 justify-center",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
>(function Button({ className, variant = "outline", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
