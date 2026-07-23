"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Lista curada e agrupada — cobre finanças, estudo, treino, comida, rotina e
// símbolos gerais. Sem dependência externa: emojis são só texto. Cada entrada
// tem "kw" (palavras-chave em pt) para a busca funcionar sem depender do char.
type Emoji = { e: string; kw: string };
type Grupo = { nome: string; itens: Emoji[] };

const GRUPOS: Grupo[] = [
  {
    nome: "Dinheiro",
    itens: [
      { e: "💰", kw: "dinheiro saco grana" },
      { e: "💵", kw: "dinheiro nota dolar" },
      { e: "💳", kw: "cartao credito" },
      { e: "🏦", kw: "banco" },
      { e: "🪙", kw: "moeda cripto" },
      { e: "📈", kw: "grafico alta investimento" },
      { e: "📉", kw: "grafico baixa" },
      { e: "💹", kw: "grafico dinheiro" },
      { e: "🧾", kw: "recibo conta nota" },
      { e: "🏷️", kw: "etiqueta preco tag" },
      { e: "🛒", kw: "compras mercado carrinho" },
      { e: "🛍️", kw: "compras sacola" },
      { e: "🏠", kw: "casa aluguel moradia" },
      { e: "🚗", kw: "carro transporte" },
      { e: "⛽", kw: "gasolina combustivel" },
      { e: "💊", kw: "saude remedio farmacia" },
    ],
  },
  {
    nome: "Estudo & trabalho",
    itens: [
      { e: "📚", kw: "livros estudo" },
      { e: "📖", kw: "livro leitura" },
      { e: "✏️", kw: "lapis escrever" },
      { e: "📝", kw: "nota escrever prova" },
      { e: "🧠", kw: "cerebro mente" },
      { e: "💻", kw: "computador programacao" },
      { e: "⌨️", kw: "teclado" },
      { e: "🇬🇧", kw: "ingles idioma bandeira" },
      { e: "🗣️", kw: "falar idioma conversa" },
      { e: "🔢", kw: "numeros matematica calculo" },
      { e: "🧪", kw: "quimica ciencia" },
      { e: "🎓", kw: "formatura faculdade" },
      { e: "💼", kw: "trabalho maleta" },
      { e: "📊", kw: "grafico dados" },
      { e: "📅", kw: "calendario agenda" },
      { e: "⏰", kw: "relogio tempo alarme" },
    ],
  },
  {
    nome: "Treino & saúde",
    itens: [
      { e: "💪", kw: "musculo treino forca" },
      { e: "🏋️", kw: "musculacao peso academia" },
      { e: "🏃", kw: "corrida correr" },
      { e: "🚴", kw: "bike ciclismo" },
      { e: "🧘", kw: "yoga meditar" },
      { e: "⚽", kw: "futebol bola" },
      { e: "🏊", kw: "natacao nadar" },
      { e: "🥗", kw: "salada dieta comida" },
      { e: "🍎", kw: "maca fruta" },
      { e: "💧", kw: "agua beber" },
      { e: "😴", kw: "sono dormir" },
      { e: "❤️", kw: "coracao saude" },
    ],
  },
  {
    nome: "Comida",
    itens: [
      { e: "🍽️", kw: "refeicao prato comida" },
      { e: "🍕", kw: "pizza" },
      { e: "🍔", kw: "hamburguer lanche" },
      { e: "🍗", kw: "frango carne proteina" },
      { e: "🍚", kw: "arroz" },
      { e: "🥤", kw: "bebida refrigerante" },
      { e: "☕", kw: "cafe" },
      { e: "🍫", kw: "chocolate doce" },
    ],
  },
  {
    nome: "Geral",
    itens: [
      { e: "⭐", kw: "estrela favorito" },
      { e: "🔥", kw: "fogo streak" },
      { e: "✅", kw: "check feito" },
      { e: "🎯", kw: "alvo meta objetivo" },
      { e: "🎉", kw: "festa comemorar" },
      { e: "🎁", kw: "presente" },
      { e: "🐶", kw: "cachorro pet" },
      { e: "✈️", kw: "viagem aviao" },
      { e: "🎵", kw: "musica" },
      { e: "🎮", kw: "jogo game lazer" },
      { e: "🛠️", kw: "ferramenta manutencao" },
      { e: "📌", kw: "pin fixar" },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.itens);

export function EmojiPicker({
  value,
  onChange,
  className,
  ariaLabel = "Escolher emoji",
}: {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return TODOS.filter((it) => it.kw.includes(q) || it.e === q);
  }, [busca]);

  function escolher(e: string) {
    onChange(e);
    setAberto(false);
    setBusca("");
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-9.5 w-full items-center justify-center rounded-[14px] border border-stroke bg-surface-2 text-[20px] leading-none transition-colors hover:border-[rgba(13,110,253,.4)] focus:border-[rgba(13,110,253,.4)] focus:outline-none",
            className
          )}
        >
          <span className="notranslate" translate="no">
            {value || "🙂"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar (ex.: dinheiro, inglês)…"
          className="mb-3 h-9 w-full rounded-[10px] border border-stroke bg-surface-2 px-3 text-[13px] text-ice outline-none transition-colors placeholder:text-steel focus:border-[rgba(13,110,253,.4)]"
        />
        <div className="max-h-64 overflow-y-auto pr-1">
          {filtrados ? (
            filtrados.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-steel">
                Nada encontrado.
              </p>
            ) : (
              <Grade itens={filtrados} atual={value} onEscolher={escolher} />
            )
          ) : (
            GRUPOS.map((g) => (
              <div key={g.nome} className="mb-3 last:mb-0">
                <p className="microlabel mb-1.5">{g.nome}</p>
                <Grade itens={g.itens} atual={value} onEscolher={escolher} />
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Grade({
  itens,
  atual,
  onEscolher,
}: {
  itens: Emoji[];
  atual: string;
  onEscolher: (e: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {itens.map((it) => (
        <button
          key={it.e}
          type="button"
          onClick={() => onEscolher(it.e)}
          className={cn(
            "flex h-9 items-center justify-center rounded-[10px] text-[19px] leading-none transition-colors hover:bg-surface-2",
            atual === it.e && "bg-mint-soft ring-1 ring-mint/40"
          )}
        >
          <span className="notranslate" translate="no">
            {it.e}
          </span>
        </button>
      ))}
    </div>
  );
}
