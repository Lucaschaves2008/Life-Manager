"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chips de tags livres — Enter ou vírgula adiciona. */
export function TagsInput({
  value,
  onChange,
  placeholder = "Adicionar tag…",
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const tag = draft.trim().replace(/,$/, "");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "flex min-h-9.5 flex-wrap items-center gap-1.5 rounded-[14px] border border-stroke bg-surface-2 px-2.5 py-1.5",
        "focus-within:border-[rgba(62,224,143,.4)]",
        className
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-[12px] text-mist"
        >
          {tag}
          <button
            aria-label={`Remover ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-steel hover:text-coral"
            type="button"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={value.length === 0 ? placeholder : ""}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) {
            setDraft(e.target.value);
            add();
          } else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !draft && value.length > 0)
            onChange(value.slice(0, -1));
        }}
        onBlur={add}
        className="min-w-24 flex-1 bg-transparent text-[13px] text-ice outline-none placeholder:text-steel"
      />
    </div>
  );
}
