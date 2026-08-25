"use server";

import { revalidatePath, revalidateTag } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { tagUsuario } from "@/lib/cache-tags";
import { marcarDiaAtivo } from "@/lib/streak";
import { fmtSP, refDoDiaSP, spStartOfDay } from "@/lib/dates";
import type { Rrule } from "@/lib/recurrence";
import { diagnosticarTemplate, type ItemDiagnostico } from "@/lib/rotina-helpers";
import {
  TIPOS_ROTINA,
  TIPO_CARDIO,
  ehTipoCardio,
  type TipoRotina,
} from "@/lib/data/rotinas-constantes";
import type { RotinaTemplateView } from "@/lib/data/rotinas";

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
  /** Texto livre ("por que esse item") — usado no card em Hábitos */
  nota?: string | null;
  /** Vitrine do item: lista do dia ("checklist") ou bloco de Hábitos */
  local?: "checklist" | "habitos";
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
  /** tipo "refeicao" → Meal da dieta ativa */
  mealId?: string | null;
  metaMinutos?: number | null;
  /** null = item comum (aparece em qualquer plano ativo no dia) */
  planoId?: string | null;
  /** Alternativas do item ("corrida OU treino") — nomes livres, na ordem dada */
  opcoes?: string[];
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
  let mealId: string | null = null;

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
  // Cardio: os três tipos usam runSessionId, mas a sessão precisa ser da
  // MODALIDADE do tipo — senão um item "Natação" ficaria vinculado a um longão
  // de corrida e marcaria sozinho no dia errado.
  if (ehTipoCardio(tipo) && input.runSessionId) {
    const sessao = await db.runSession.findFirst({
      where: {
        id: input.runSessionId,
        userId,
        routine: { modalidade: TIPO_CARDIO[tipo] },
      },
      select: { id: true },
    });
    runSessionId = sessao?.id ?? null;
  }
  if (tipo === "refeicao" && input.mealId) {
    const meal = await db.meal.findFirst({
      where: { id: input.mealId, userId },
      select: { id: true },
    });
    mealId = meal?.id ?? null;
  }

  return { tipo, studyCategoryId, routineId, runSessionId, mealId };
}

/** Nomes de opção limpos, sem vazios/duplicados. Menos de 2 = item sem escolha. */
function normalizarOpcoes(opcoes?: string[]): string[] {
  const limpas = (opcoes ?? []).map((o) => o.trim()).filter(Boolean);
  const unicas = [...new Set(limpas)];
  return unicas.length >= 2 ? unicas.slice(0, 6) : [];
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

/** Diagnóstico + a próxima data já formatada em pt-BR para a mensagem da tela. */
export type ItemDiagnosticoUI = ItemDiagnostico & { proximaLabel: string | null };

/**
 * Diagnóstico do item recém-salvo, para a tela poder dizer a verdade sobre a
 * lista de hoje. A regra pura mora em lib/rotina-helpers (e é testada lá);
 * aqui só buscamos o que ela precisa do banco.
 */
async function diagnosticarItem(
  userId: string,
  templateId: string,
  dia: string
): Promise<ItemDiagnosticoUI> {
  const vazio = {
    apareceHoje: false,
    motivo: null,
    planoNome: null,
    planoDoDiaNome: null,
    proximaOcorrencia: null,
    proximaLabel: null,
  } as const;

  const template = await db.rotinaTemplate.findFirst({ where: { id: templateId, userId } });
  if (!template) return vazio;

  const ref = refDoDiaSP(dia);
  const [planos, escolha] = await Promise.all([
    db.rotinaPlano.findMany({
      where: { userId, ativo: true },
      select: { id: true, nome: true, padrao: true },
    }),
    db.rotinaDiaPlano.findFirst({
      where: { userId, data: spStartOfDay(ref) },
      select: { planoId: true },
    }),
  ]);

  const diagnostico = diagnosticarTemplate({
    template,
    planoId: template.planoId,
    planoDoDiaId: escolha?.planoId ?? planos.find((p) => p.padrao)?.id ?? null,
    planos,
    dia: ref,
  });

  return {
    ...diagnostico,
    proximaLabel: diagnostico.proximaOcorrencia
      ? fmtSP(diagnostico.proximaOcorrencia, "EEEE, d 'de' MMMM")
      : null,
  };
}

export async function criarRotinaTemplate(input: RotinaTemplateInput): Promise<ItemDiagnosticoUI> {
  const { id: userId } = await requireUser();
  const validado = validarHorarios(input);
  if (!validado) throw new Error("Horário inválido: o fim deve ser depois do início.");

  const { tipo, studyCategoryId, routineId, runSessionId, mealId } = await resolverVinculos(
    userId,
    input
  );
  const planoId = await resolverPlano(userId, input.planoId);
  const opcoes = normalizarOpcoes(input.opcoes);
  const total = await db.rotinaTemplate.count({ where: { userId, ativo: true } });

  const criado = await db.rotinaTemplate.create({
    data: {
      nome: validado.nome,
      nota: input.nota?.trim() || null,
      local: input.local === "habitos" ? "habitos" : "checklist",
      horaInicio: validado.horaInicio,
      horaFim: validado.horaFim,
      dataInicio: dataDoDia(input.dataInicio),
      rrule: montarRrule(input),
      ordem: total,
      tipo,
      studyCategoryId,
      routineId,
      runSessionId,
      mealId,
      metaMinutos: input.metaMinutos ?? null,
      planoId,
      userId,
      opcoes: {
        create: opcoes.map((nome, ordem) => ({ nome, ordem, userId })),
      },
    },
  });
  revalidar(userId);
  return diagnosticarItem(userId, criado.id, input.dataInicio);
}

export async function atualizarRotinaTemplate(
  id: string,
  input: RotinaTemplateInput
): Promise<ItemDiagnosticoUI> {
  const { id: userId } = await requireUser();
  const validado = validarHorarios(input);
  if (!validado) throw new Error("Horário inválido: o fim deve ser depois do início.");

  const existente = await db.rotinaTemplate.findFirst({ where: { id, userId }, select: { id: true } });
  // Antes isto era um `return` mudo: a tela dizia "Item atualizado" sem nada
  // ter sido gravado. Falhar em voz alta é o único jeito de o usuário saber.
  if (!existente) throw new Error("Item não encontrado — recarregue a página.");

  const { tipo, studyCategoryId, routineId, runSessionId, mealId } = await resolverVinculos(
    userId,
    input
  );
  const planoId = await resolverPlano(userId, input.planoId);

  await db.rotinaTemplate.update({
    where: { id, userId },
    data: {
      nome: validado.nome,
      nota: input.nota?.trim() || null,
      local: input.local === "habitos" ? "habitos" : "checklist",
      horaInicio: validado.horaInicio,
      horaFim: validado.horaFim,
      dataInicio: dataDoDia(input.dataInicio),
      rrule: montarRrule(input),
      tipo,
      studyCategoryId,
      routineId,
      runSessionId,
      mealId,
      metaMinutos: input.metaMinutos ?? null,
      planoId,
    },
  });
  await sincronizarOpcoes(userId, id, normalizarOpcoes(input.opcoes));
  revalidar(userId);
  return diagnosticarItem(userId, id, input.dataInicio);
}

/**
 * Reconcilia as opções do item POR NOME em vez de recriar tudo: opção que
 * continua na lista mantém o mesmo id, e com ele o histórico dos dias em que
 * foi a escolhida (RotinaCheckDia.opcaoId). Recriar do zero a cada edição
 * transformaria "corri terça e quinta" em dois dias sem rótulo nenhum.
 */
async function sincronizarOpcoes(userId: string, rotinaId: string, nomes: string[]) {
  const atuais = await db.rotinaTemplateOpcao.findMany({
    where: { rotinaId, userId },
    select: { id: true, nome: true },
  });
  const porNome = new Map(atuais.map((o) => [o.nome, o.id]));
  const manter = nomes.map((n) => porNome.get(n)).filter((v): v is string => Boolean(v));

  await db.$transaction([
    db.rotinaTemplateOpcao.deleteMany({
      where: { rotinaId, userId, id: { notIn: manter.length > 0 ? manter : ["-"] } },
    }),
    ...nomes.map((nome, ordem) => {
      const existenteId = porNome.get(nome);
      return existenteId
        ? db.rotinaTemplateOpcao.update({ where: { id: existenteId }, data: { ordem } })
        : db.rotinaTemplateOpcao.create({ data: { rotinaId, userId, nome, ordem } });
    }),
  ]);
}

/**
 * Duplica o item (horário, recorrência, vínculos e opções inclusos) com
 * "(cópia)" no nome, e devolve o template pronto para o form de edição — o
 * fluxo é sempre duplicar e já deixar o usuário ajustar o que for diferente.
 */
export async function duplicarRotinaTemplate(id: string): Promise<RotinaTemplateView> {
  const { id: userId } = await requireUser();
  const original = await db.rotinaTemplate.findFirst({
    where: { id, userId, ativo: true },
    include: { opcoes: { orderBy: { ordem: "asc" } } },
  });
  if (!original) throw new Error("Item não encontrado — recarregue a página.");

  const total = await db.rotinaTemplate.count({ where: { userId, ativo: true } });
  const copia = await db.rotinaTemplate.create({
    data: {
      nome: `${original.nome} (cópia)`,
      nota: original.nota,
      local: original.local,
      horaInicio: original.horaInicio,
      horaFim: original.horaFim,
      dataInicio: original.dataInicio,
      rrule: original.rrule,
      ordem: total,
      tipo: original.tipo,
      studyCategoryId: original.studyCategoryId,
      routineId: original.routineId,
      runSessionId: original.runSessionId,
      mealId: original.mealId,
      metaMinutos: original.metaMinutos,
      planoId: original.planoId,
      userId,
      opcoes: {
        create: original.opcoes.map((o) => ({ nome: o.nome, ordem: o.ordem, userId })),
      },
    },
    include: { opcoes: { orderBy: { ordem: "asc" } } },
  });
  revalidar(userId);

  return {
    id: copia.id,
    nome: copia.nome,
    nota: copia.nota,
    local: copia.local === "habitos" ? "habitos" : "checklist",
    horaInicio: copia.horaInicio,
    horaFim: copia.horaFim,
    rrule: copia.rrule,
    exdates: [],
    ordem: copia.ordem,
    tipo: copia.tipo as TipoRotina,
    studyCategoryId: copia.studyCategoryId,
    routineId: copia.routineId,
    runSessionId: copia.runSessionId,
    mealId: copia.mealId,
    metaMinutos: copia.metaMinutos,
    planoId: copia.planoId,
    opcoes: copia.opcoes.map((o) => ({ id: o.id, nome: o.nome })),
  };
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

/**
 * Marca/desmarca a ocorrência do dia (upsert/delete de RotinaCheckDia).
 *
 * `opcaoId` registra QUAL alternativa foi feita num item com opções ("hoje foi
 * corrida, não musculação"). Passá-lo num item já marcado apenas TROCA a
 * escolha — sem isso, tocar em outra opção desmarcaria o item, que é o oposto
 * do esperado. O item continua contando uma vez só para metas e desafios.
 */
export async function toggleRotinaCheckDia(
  templateId: string,
  dia: string,
  opcaoId?: string | null
) {
  const { id: userId } = await requireUser();
  const rotina = await db.rotinaTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!rotina) throw new Error("Item não encontrado — recarregue a página.");

  // Opção de outro item (ou já excluída) não vira escolha: grava sem rótulo.
  const opcaoValida = opcaoId
    ? await db.rotinaTemplateOpcao.findFirst({
        where: { id: opcaoId, rotinaId: templateId, userId },
        select: { id: true },
      })
    : null;

  const data = dataDoDia(dia);
  const existente = await db.rotinaCheckDia.findFirst({
    where: { userId, rotinaId: templateId, data },
  });
  if (existente) {
    if (opcaoValida && existente.opcaoId !== opcaoValida.id) {
      await db.rotinaCheckDia.update({
        where: { id: existente.id },
        data: { opcaoId: opcaoValida.id },
      });
    } else {
      await db.rotinaCheckDia.delete({ where: { id: existente.id } });
      // NÃO desfaz o StreakDia: a ofensiva do dia é permanente (só desmarcou).
    }
  } else {
    // toggle manual: nunca marca feitoAuto (esse flag é só da execução real)
    await db.rotinaCheckDia.create({
      data: { userId, rotinaId: templateId, data, feitoAuto: false, opcaoId: opcaoValida?.id ?? null },
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
  if (!rotina) throw new Error("Item não encontrado — recarregue a página.");

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
  if (!plano) throw new Error("Plano não encontrado — recarregue a página.");

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
  if (!plano) throw new Error("Plano não encontrado — recarregue a página.");

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
  if (!plano) throw new Error("Plano não encontrado — recarregue a página.");

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

// ---------- Registro do dia (descrição + dashboard de histórico) ----------

/** Salva/atualiza a descrição do dia (escrita ao concluir o checklist, ou depois). */
export async function salvarDiaRegistro(dia: string, descricao: string, pct: number) {
  const { id: userId } = await requireUser();
  const data = dataDoDia(dia);
  const texto = descricao.trim();
  if (!texto) return;

  await db.diaRegistro.upsert({
    where: { userId_data: { userId, data } },
    create: { userId, data, descricao: texto, pct: Math.round(pct) },
    update: { descricao: texto, pct: Math.round(pct) },
  });
  revalidar(userId);
}

export async function excluirDiaRegistro(dia: string) {
  const { id: userId } = await requireUser();
  const data = dataDoDia(dia);
  await db.diaRegistro.deleteMany({ where: { userId, data } });
  revalidar(userId);
}

/** "Reiniciar dia" — desmarca tudo que foi feito naquele dia (rotinas + variáveis), sem tocar nos moldes. */
export async function reiniciarDiaChecklist(dia: string) {
  const { id: userId } = await requireUser();
  const data = dataDoDia(dia);
  await db.$transaction([
    db.rotinaCheckDia.deleteMany({ where: { userId, data } }),
    db.variavelCheckDia.deleteMany({ where: { userId, data } }),
    db.diaRegistro.deleteMany({ where: { userId, data } }),
  ]);
  revalidar(userId);
}
