import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayKeySP, nowSP } from "@/lib/dates";
import { nomeArquivo, paraCSV } from "@/lib/exportar";

/**
 * Exportação dos dados do usuário. SOMENTE LEITURA — nunca escreve nem apaga.
 *
 * Toda query é escopada por `userId` do usuário logado (via getCurrentUser),
 * então não há como um usuário baixar dados de outro. Formatos: json (tudo de
 * uma vez) ou csv (um conjunto por vez, via ?conjunto=).
 */

export const dynamic = "force-dynamic";

const CONJUNTOS = [
  "transacoes",
  "ativos",
  "movimentos",
  "treinos",
  "corridas",
  "peso",
  "estudos",
] as const;

type Conjunto = (typeof CONJUNTOS)[number];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const formato = request.nextUrl.searchParams.get("formato") ?? "json";
  const conjunto = request.nextUrl.searchParams.get("conjunto");
  const dia = dayKeySP(nowSP());

  if (formato === "csv") {
    if (!conjunto || !CONJUNTOS.includes(conjunto as Conjunto)) {
      return NextResponse.json(
        { erro: `Informe ?conjunto= com um de: ${CONJUNTOS.join(", ")}` },
        { status: 400 }
      );
    }
    const { linhas, colunas } = await carregarConjunto(user.id, conjunto as Conjunto);
    return new NextResponse(paraCSV(linhas, colunas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo(conjunto, dia, "csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const tudo: Record<string, unknown> = {
    exportadoEm: new Date().toISOString(),
    perfil: { email: user.email, nome: user.nome },
  };
  for (const c of CONJUNTOS) {
    tudo[c] = (await carregarConjunto(user.id, c)).linhas;
  }

  return new NextResponse(JSON.stringify(tudo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo("completo", dia, "json")}"`,
      "Cache-Control": "no-store",
    },
  });
}

type Resultado = {
  linhas: Record<string, unknown>[];
  colunas: string[];
};

async function carregarConjunto(userId: string, conjunto: Conjunto): Promise<Resultado> {
  switch (conjunto) {
    case "transacoes": {
      const rows = await db.transaction.findMany({
        where: { userId },
        orderBy: { data: "desc" },
        include: { category: { select: { nome: true } }, account: { select: { nome: true } } },
      });
      return {
        colunas: ["data", "tipo", "natureza", "valorCentavos", "descricao", "categoria", "conta", "paga"],
        linhas: rows.map((t) => ({
          data: dayKeySP(t.data),
          tipo: t.tipo,
          natureza: t.natureza,
          valorCentavos: t.valor,
          descricao: t.descricao,
          categoria: t.category?.nome ?? "",
          conta: t.account?.nome ?? "",
          paga: t.paga,
        })),
      };
    }
    case "ativos": {
      const rows = await db.asset.findMany({ where: { userId }, orderBy: { criadoEm: "asc" } });
      return {
        colunas: ["nome", "classe", "instituicao", "criadoEm"],
        linhas: rows.map((a) => ({
          nome: a.nome,
          classe: a.classe,
          instituicao: a.instituicao,
          criadoEm: dayKeySP(a.criadoEm),
        })),
      };
    }
    case "movimentos": {
      const rows = await db.assetMovement.findMany({
        where: { userId },
        orderBy: { data: "desc" },
        include: { asset: { select: { nome: true } } },
      });
      return {
        colunas: ["data", "ativo", "tipo", "valorCentavos", "nota"],
        linhas: rows.map((m) => ({
          data: dayKeySP(m.data),
          ativo: m.asset.nome,
          tipo: m.tipo,
          valorCentavos: m.valor,
          nota: m.nota ?? "",
        })),
      };
    }
    case "treinos": {
      const rows = await db.workoutSession.findMany({
        where: { userId },
        orderBy: { data: "desc" },
        include: { routine: { select: { nome: true } }, setLogs: true },
      });
      return {
        colunas: ["data", "ficha", "duracaoMin", "series", "tonelagemKg", "notas"],
        linhas: rows.map((s) => ({
          data: dayKeySP(s.data),
          ficha: s.routine?.nome ?? "",
          duracaoMin: s.duracaoMin,
          series: s.setLogs.length,
          tonelagemKg: s.setLogs.reduce((t, l) => t + l.reps * l.cargaKg, 0),
          notas: s.notas ?? "",
        })),
      };
    }
    case "corridas": {
      const rows = await db.run.findMany({ where: { userId }, orderBy: { data: "desc" } });
      return {
        colunas: ["data", "modalidade", "km", "segundos", "tipo", "sensacao", "notas"],
        linhas: rows.map((r) => ({
          data: dayKeySP(r.data),
          modalidade: r.modalidade,
          km: r.km,
          segundos: r.segundos,
          tipo: r.tipo,
          sensacao: r.sensacao,
          notas: r.notas ?? "",
        })),
      };
    }
    case "peso": {
      const rows = await db.weightLog.findMany({ where: { userId }, orderBy: { data: "desc" } });
      return {
        colunas: ["data", "pesoKg", "percentualGordura", "massaMuscular", "cintura"],
        linhas: rows.map((w) => ({
          data: dayKeySP(w.data),
          pesoKg: w.pesoKg,
          percentualGordura: w.percentualGordura ?? "",
          massaMuscular: w.massaMuscular ?? "",
          cintura: w.cintura ?? "",
        })),
      };
    }
    case "estudos": {
      const rows = await db.studySession.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        include: { category: { select: { nome: true } } },
      });
      return {
        colunas: ["data", "assunto", "categoria", "minutosLiquidos", "nota"],
        linhas: rows.map((s) => ({
          data: dayKeySP(s.startedAt),
          assunto: s.subject,
          categoria: s.category?.nome ?? "",
          minutosLiquidos: Math.round(s.netSeconds / 60),
          nota: s.notes ?? "",
        })),
      };
    }
  }
}
