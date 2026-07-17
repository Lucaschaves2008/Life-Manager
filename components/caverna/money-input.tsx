"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBRLPlain } from "@/lib/money";

/**
 * Input de dinheiro com máscara R$ 0,00 — value SEMPRE em centavos.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
  className,
}: {
  value: number;
  onChange: (centavos: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value > 0 ? formatBRLPlain(value) : "");

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-steel">
        R$
      </span>
      <Input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          // digita como calculadora: só dígitos, últimos 2 = centavos
          const digits = e.target.value.replace(/\D/g, "");
          const centavos = digits ? parseInt(digits, 10) : 0;
          setText(centavos > 0 ? formatBRLPlain(centavos) : "");
          onChange(centavos);
        }}
        className={`pl-10 tabular ${className ?? ""}`}
      />
    </div>
  );
}
