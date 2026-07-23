"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Theme = "dark" | "light";

/** Seletor de tema do app — persiste em localStorage e aplica via data-theme na raiz. */
export function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // O ThemeScript (bloqueante, no <head>) já aplicou data-theme na raiz
    // antes do paint — aqui só sincronizamos o estado do <Select> com ele.
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("life-manager-theme", next);
  }

  return (
    <Select value={theme} onValueChange={(v) => apply(v as Theme)}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Claro</SelectItem>
        <SelectItem value="dark">Escuro</SelectItem>
      </SelectContent>
    </Select>
  );
}
