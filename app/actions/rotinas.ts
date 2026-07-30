"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { marcarDiaAtivo } from "@/lib/streak";
import { spStartOfDay } from "@/lib/dates";
import type { Rrule } from "@/lib/recurrence";
import { TIPOS_ROTINA, type TipoRotina } from "@/lib/data/rotinas";

function revalidar(userId: string) {
  revalidateTag(tagUsuario(userId, "checklist"));
  revalidatePath("/checklist");
  revalidatePath("/agenda");
  revalidatePath("/");
}

/** Início do dia em SP a partir de "yyyy-MM-dd", como Date UTC. */
function dataDoDia(dia: string): Date {
  return spStartOfDay(new Date(`${dia}T12:00:00-03:00`));
}

function normalizarHora(hora?: string | null): string | null {
  if (!hora) return null;
  const m = hora.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Number(m[1]));
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export type RotinaTemplateInput = {
  nome: string;
  /** "HH:mm" opcional — item "livre" pode não ter hora */
  horaInicio?: string | null;
  /** "HH:mm" opcional — deve ser > horaInicio quando ambos presentes */
  horaFim?: string | null;
  /** yyyy-MM-dd — dia-âncora da recorrência (ou o próprio dia, se "nunca") */
  dataInicio: string;
  tipoRecorrencia: "nunca" | "todoDia" | "diasSemana" | "intervalo";
  /** 0=dom..6=sáb — só quando tipoRecorrencia="diasSemana" */
  diasSemana?: number[];
  /** yyyy-MM-dd opcional -> vira `until` no rrule (usável com "todoDia"/"diasSemana"/"intervalo") */
  dataFim?: string | null;
  tipo: TipoRotina;
  studyCategoryId?: string | null;
  routineId?: string | null;
  runSessionId?: string | null;
  metaMinutos?: number | null;
  /** null = item comum (aparece em qualquer plano ativo no dia) */
  planoId?: string | null;
};

function montarRrule(input: RotinaTemplateInput): string | null {
  if (input.tipoRecorrencia === "nunca") return null;
  const until = input.dataFim ? `${input.dataFim}T23:59:59-03:00` : undefined;
  if (input.tipoRecorrencia === "diasSemana" && input.diasSemana && input.diasSemana.length > 0) {
    const rrule: Rrule = { freq: "weekly", byday: input.diasSemana };
    if (until) rrule.until = until;
    return JSON.stringify(rrule);
  }
  // "todoDia" ou "intervalo" sem dias específicos => diária, com ou sem until
  const rrule: Rrule = { freq: "daily" };
  if (until) rrule.until = until;
  return JSON.stringify(rrule);
}

/** Valida nome preenchido e, se ambas as horas vierem, horaFim > horaInicio. */
function validarHorarios(
  input: RotinaTemplateInput
): { nome: string; horaInicio: string | null; horaFim: string | null } | null {
  const nome = input.nome.trim();
  if (!nome) return null;
  const horaInicio = normalizarHora(input.horaInicio);
  const horaFim = normalizarHora(input.horaFim);
  if (horaInicio && horaFim && horaFim <= horaInicio) return null;
  return { nome, horaInicio, horaFim };
}

/**
 * Resolve os vínculos conforme o tipo, validando propriedade. Zera vínculos
 * que não pertencem ao tipo (ex.: tipo "livre" nunca guarda categoria).
 */
async function resolverVinculos(userId: string, input: RotinaTemplateInput) {
  const tipo: TipoRotina = TIPOS_ROTINA.includes(input.tipo) ? input.tipo : "livre";
  let studyCategoryId: string | null = null;
  let routineId: string | null = null;
  let runSessionId: string | null = null;

  if (tipo === "estudo" && input.studyCategoryId) {
    const cat = await db.studyCategory.findFirst({
      where: { id: input.studyCategoryId, userId, ativo: true },
      select: { id: true },
    });
    studyCategoryId = cat?.id ?? null;
  }
  if (tipo === "treino" && input.routineId) {
    const rot = await db.routine.findFirst({
      where: { id: input.routineId, userId },
      select: { id: true },
    });
    routineId = rot?.id ?? null;
  }
  if (tipo === "corrida" && input.runSessionId) {
    const sessao = await db.runSession.findFirst({
      where: { id: input.runSessionId, userId },
      select: { id: true },
    });
    runSessionId = sessao?.id ?? null;
  }

  return { tipo, studyCategoryId, routineId, runSessionId };
}

/** null se planoId vier vazio, ou se não pertencer ao usuário. */
async function resolverPlano(userId: string, planoId?: string | null): Promise<string | null> {
  if (!planoId) return null;
  const plano = await db.rotinaPlano.findFirst({
    where: { id: planoId, userId, ativo: true },
    select: { id: true },
  });
  return plano?.id ?? null;
}

export async function criarRotinaTemplate(input: RotinaTemplateInput) {
  const { id: userId } = await requireUser();
  const validado = validarHorarios(input);
  if (!validado) throw new Error("Horário inválido: o fim deve ser depois do início.");

  const { tipo, studyCategoryId, routineId, runSessionId } = await resolverVinculos(userId, input);
  const planoId = await resolverPlano(userId, input.planoId);
  const total = await db.rotinaTemplate.count({ where: { userId, ativo: true } });

  await db.rotinaTemplate.create({
    data: {
      nome: validado.nome,
      horaInicio: validado.horaInicio,
      horaFim: validado.horaFim,
      dataInicio: dataDoDia(input.dataInicio),
      rrule: montarRrule(input),
      ordem: total,
      tipo,
      studyCategoryId,
      routineId,
      runSessionId,
      metaMinutos: input.metaMinutos ?? null,
      planoId,
      userId,
    },
  });
  revalidar(userId);
}

export async function atualizarRotinaTemplate(id: string, input: RotinaTemplateInput) {
  const { id: userId } = await requireUser();
  const validado = validarHorarios(input);
  if (!validado) throw new Error("Horário inválido: o fim deve ser depois do início.");

  const existente = await db.rotinaTemplate.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existente) return;

  const { tipo, studyCategoryId, routineId, runSessionId } = await resolverVinculos(userId, input);
  const planoId = await resolverPlano(userId, input.planoId);

  await db.rotinaTemplate.update({
    where: { id, userId },
    data: {
      nome: validado.nome,
      horaInicio: validado.horaInicio,
      horaFim: validado.horaFim,
      dataInicio: dataDoDia(input.dataInicio),
      rrule: montarRrule(input),
      tipo,
      studyCategoryId,
      routineId,
      runSessionId,
      metaMinutos: input.metaMinutos ?? null,
      planoId,
    },
  });
  revalidar(userId);
}

export async function excluirRotinaTemplate(id: string) {
  const { id: userId } = await requireUser();
  await db.rotinaTemplate.update({ where: { id, userId }, data: { ativo: false } });
  revalidar(userId);
}

/** Troca a ordem do template com o vizinho (direcao -1 = sobe, 1 = desce). */
export async function moverRotinaTemplate(id: string, direcao: -1 | 1) {
  const { id: userId } = await requireUser();
  const irmaos = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true },
    orderBy: { ordem: "asc" },
  });
  const i = irmaos.findIndex((t) => t.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= irmaos.length) return;

  await db.$transaction([
    db.rotinaTemplate.update({ where: { id: irmaos[i].id, userId }, data: { ordem: irmaos[j].ordem } }),
    db.rotinaTemplate.update({ where: { id: irmaos[j].id, userId }, data: { ordem: irmaos[i].ordem } }),
  ]);
  revalidar(userId);
}

function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function diffMinutos(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/**
 * Aplica a nova ordem (drag-and-drop) e reencadeia os horários: cada item que
 * tem horaInicio/horaFim mantém a PRÓPRIA duração, mas é reencaixado em
 * sequência a partir do horário do primeiro item com hora da nova ordem.
 * Itens sem horário só têm a `ordem` trocada, sem entrar na cadeia.
 */
export async function reordenarRotinaTemplates(orderedIds: string[]) {
  const { id: userId } = await requireUser();
  const templates = await db.rotinaTemplate.findMany({
    where: { userId, ativo: true, id: { in: orderedIds } },
  });
  const porId = new Map(templates.map((t) => [t.id, t]));

  const novaOrdem = orderedIds.filter((id) => porId.has(id));
  if (novaOrdem.length !== templates.length) return;

  // duração original de cada item com hora, preservada na nova sequência
  const duracoes = new Map<string, number>();
  for (const t of templates) {
    if (t.horaInicio && t.horaFim) {
      duracoes.set(t.id, diffMinutos(t.horaInicio, t.horaFim));
    }
  }

  const updates: { id: string; horaInicio: string; horaFim: string | null }[] = [];
  let horaAtual: string | null = null;
  for (const id of novaOrdem) {
    const t = porId.get(id)!;
    if (!t.horaInicio) continue;
    const novoInicio: string = horaAtual === null ? t.horaInicio : horaAtual;
    const duracao = duracoes.get(id);
    const novoFim = duracao != null ? somarMinutos(novoInicio, duracao) : null;
    updates.push({ id, horaInicio: novoInicio, horaFim: novoFim });
    horaAtual = novoFim ?? novoInicio;
  }

  await db.$transaction([
    ...novaOrdem.map((id, ordem) =>
      db.rotinaTemplate.update({ where: { id, userId }, data: { ordem } })
    ),
    ...updates.map((u) =>
      db.rotinaTemplate.update({
        where: { id: u.id, userId },
        data: { horaInicio: u.horaInicio, horaFim: u.horaFim },
      })
    ),
  ]);
  revalidar(userId);
}

/** Marca/desmarca a ocorrência do dia (upsert/delete de RotinaCheckDia). */
export async function toggleRotinaCheckDia(templateId: string, dia: string) {
  const { id: userId } = await requireUser();
  const rotina = await db.rotinaTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!rotina) return;

  const data = dataDoDia(dia);
  const existente = await db.rotinaCheckDia.findFirst({
    where: { userId, rotinaId: templateId, data },
  });
  if (existente) {
    await db.rotinaCheckDia.delete({ where: { id: existente.id } });
    // NÃO desfaz o StreakDia: a ofensiva do dia é permanente (só desmarcou).
  } else {
    // toggle manual: nunca marca feitoAuto (esse flag é só da execução real)
    await db.rotinaCheckDia.create({
      data: { userId, rotinaId: templateId, data, feitoAuto: false },
    });
    await marcarDiaAtivo(userId, dia); // conquista o dia (permanente)
  }
  revalidar(userId);
}

/** "Não fazer hoje" — adiciona o dia a exdates sem apagar o template. */
export async function pularRotinaHoje(templateId: string, dia: string) {
  const { id: userId } = await requireUser();
  const rotina = await db.rotinaTemplate.findFirst({
    where: { id: templateId, userId },
    select: { exdates: true },
  });
  if (!rotina) return;

  let atuais: string[] = [];
  try {
    const v = JSON.parse(rotina.exdates);
    if (Array.isArray(v)) atuais = v;
  } catch {
    atuais = [];
  }
  if (!atuais.includes(dia)) {
    await db.rotinaTemplate.update({
      where: { id: templateId, userId },
      data: { exdates: JSON.stringify([...atuais, dia]) },
    });
    revalidar(userId);
  }
}

// ---------- Planos alternativos (Plano A / Plano B / ...) ----------

/**
 * Cria um plano nomeado. O primeiro plano do usuário nasce marcado como
 * padrão e "adota" todos os itens hoje soltos ("comuns", planoId=null) —
 * sem isso, o primeiro plano nasceria com o checklist inteiro já dentro
 * dele por "comum", e qualquer plano novo criado depois nasceria vazio
 * mas o A continuaria enxergando tudo (o que é o comportamento certo:
 * cada plano isolado, exceto o que for marcado comum deliberadamente).
 */
export async function criarRotinaPlano(nome: string) {
  const { id: userId } = await requireUser();
  const nomeAparado = nome.trim();
  if (!nomeAparado) return;

  const total = await db.rotinaPlano.count({ where: { userId, ativo: true } });
  const ehPrimeiro = total === 0;

  const plano = await db.rotinaPlano.create({
    data: { nome: nomeAparado, ordem: total, padrao: ehPrimeiro, userId },
  });

  if (ehPrimeiro) {
    await db.rotinaTemplate.updateMany({
      where: { userId, ativo: true, planoId: null },
      data: { planoId: plano.id },
    });
  }
  revalidar(userId);
}

export async function renomearRotinaPlano(id: string, nome: string) {
  const { id: userId } = await requireUser();
  const nomeAparado = nome.trim();
  if (!nomeAparado) return;
  await db.rotinaPlano.update({ where: { id, userId }, data: { nome: nomeAparado } });
  revalidar(userId);
}

/** Marca este plano como padrão (usado em dias sem escolha explícita) e desmarca os demais. */
export async function definirRotinaPlanoPadrao(id: string) {
  const { id: userId } = await requireUser();
  const plano = await db.rotinaPlano.findFirst({ where: { id, userId, ativo: true }, select: { id: true } });
  if (!plano) return;

  await db.$transaction([
    db.rotinaPlano.updateMany({ where: { userId }, data: { padrao: false } }),
    db.rotinaPlano.update({ where: { id, userId }, data: { padrao: true } }),
  ]);
  revalidar(userId);
}

/**
 * Exclui o plano (soft delete). Itens vinculados a ele viram "comuns"
 * (planoId=null) em vez de sumir do checklist. Se era o padrão, promove o
 * próximo plano ativo a padrão.
 */
export async function excluirRotinaPlano(id: string) {
  const { id: userId } = await requireUser();
  const plano = await db.rotinaPlano.findFirst({ where: { id, userId, ativo: true } });
  if (!plano) return;

  await db.$transaction([
    db.rotinaTemplate.updateMany({ where: { userId, planoId: id }, data: { planoId: null } }),
    db.rotinaPlano.update({ where: { id, userId }, data: { ativo: false, padrao: false } }),
  ]);

  if (plano.padrao) {
    const proximo = await db.rotinaPlano.findFirst({
      where: { userId, ativo: true },
      orderBy: { ordem: "asc" },
    });
    if (proximo) {
      await db.rotinaPlano.update({ where: { id: proximo.id, userId }, data: { padrao: true } });
    }
  }
  revalidar(userId);
}

/**
 * Escolhe o plano vigente para um dia específico ("hoje foi Plano B"). Passar
 * o próprio plano padrão remove a escolha explícita (volta ao comportamento
 * padrão do dia).
 */
export async function escolherRotinaPlanoDoDia(dia: string, planoId: string) {
  const { id: userId } = await requireUser();
  const plano = await db.rotinaPlano.findFirst({ where: { id: planoId, userId, ativo: true } });
  if (!plano) return;

  const data = dataDoDia(dia);
  if (plano.padrao) {
    await db.rotinaDiaPlano.deleteMany({ where: { userId, data } });
  } else {
    await db.rotinaDiaPlano.upsert({
      where: { userId_data: { userId, data } },
      create: { userId, data, planoId },
      update: { planoId },
    });
  }
  revalidar(userId);
}
