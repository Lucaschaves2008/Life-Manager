"use client";

import { useEffect, useState } from "react";
import {
  TAB_BAR_FINANCAS,
  TAB_BAR_SLOT_OPCOES,
  TAB_BAR_TREINOS,
  type NavItem,
} from "@/lib/nav";

const STORAGE_KEY = "life-manager-tab-bar-slots";

type SlotHrefs = { esquerda: string; direita: string };

const PADRAO: SlotHrefs = {
  esquerda: TAB_BAR_TREINOS.href,
  direita: TAB_BAR_FINANCAS.href,
};

function resolveItem(href: string): NavItem {
  return TAB_BAR_SLOT_OPCOES.find((i) => i.href === href) ?? TAB_BAR_TREINOS;
}

/** Preferência do usuário para os 2 slots configuráveis da tab bar mobile (por dispositivo). */
export function useTabBarPrefs() {
  const [slots, setSlots] = useState<SlotHrefs>(PADRAO);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SlotHrefs>;
      setSlots({
        esquerda: parsed.esquerda ?? PADRAO.esquerda,
        direita: parsed.direita ?? PADRAO.direita,
      });
    } catch {
      // localStorage corrompido — mantém o padrão.
    }
  }, []);

  function setSlot(posicao: "esquerda" | "direita", href: string) {
    setSlots((atual) => {
      const proximo = { ...atual, [posicao]: href };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proximo));
      return proximo;
    });
  }

  return {
    esquerda: resolveItem(slots.esquerda),
    direita: resolveItem(slots.direita),
    setSlot,
  };
}
