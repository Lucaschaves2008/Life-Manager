"use server";

import { revalidatePath } from "@/lib/cache-revalidate";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { desafioDetalhe, type DesafioDetalhe, type DesafioOrigem, type DesafioPeriodo } from "@/lib/data/desafios";
import { PERIODOS_DESAFIO } from "@/lib/data/desafios-constantes";
import { METRICAS, type MetaMetrica } from "@/lib/data/metas-quantitativas-constantes";
import {
  solicitacoesDoDesafio,
  type SolicitacaoTipo,
  type SolicitacaoView,
} from "@/lib/data/desafios-solicitacoes";
import { shortDate } from "@/lib/dates";
import { mensagensDoDesafio, type MensagemView } from "@/lib/data/desafios-chat";
import { documentoDoDesafio, type DesafioDocumentoView } from "@/lib/data/desafios-documento";
import { uploadDesafioDocumento, removeDesafioDocumento } from "@/lib/supabase/storage";

// lib/data/desafios.ts não usa "use cache" (progresso cruza dados de outros
// usuários/módulos — cache por tag de um único userId não se aplica aqui),
// então a leitura já é sempre fresh; só precisamos invalidar as rotas.
function revalidar(desafioId?: string) {
  revalidatePath("/desafios");
  if (desafioId) revalidatePath(`/desafios/${desafioId}`);
}

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I (ambíguos)

function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}

async function codigoUnico(): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const codigo = gerarCodigo();
    const existe = await db.desafio.findUnique({ where: { codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  throw new Error("Não foi possível gerar um código único. Tente novamente.");
}

async function requireMembro(desafioId: string, userId: string) {
  const membro = await db.desafioMembro.findUnique({
    where: { desafioId_userId: { desafioId, userId } },
  });
  if (!membro) throw new Error("Você não participa deste desafio.");
}

async function requireCriador(desafioId: string, userId: string) {
  const desafio = await db.desafio.findUnique({ where: { id: desafioId }, select: { criadorId: true } });
  if (!desafio) throw new Error("Desafio não encontrado.");
  if (desafio.criadorId !== userId) throw new Error("Só o criador do desafio pode fazer isso.");
  return desafio;
}

export async function criarDesafio(input: { nome: string; descricao?: string; metasGrandesLimite: number }) {
  const { id: userId } = await requireUser();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Dê um nome ao desafio.");
  const limite = Math.min(10, Math.max(1, Math.round(input.metasGrandesLimite)));

  const codigo = await codigoUnico();
  const desafio = await db.desafio.create({
    data: {
      nome,
      descricao: input.descricao?.trim() || null,
      codigo,
      metasGrandesLimite: limite,
      criadorId: userId,
      membros: { create: { userId } },
    },
  });
  revalidar(desafio.id);
  return desafio;
}

export async function entrarNoDesafio(codigoInput: string) {
  const { id: userId } = await requireUser();
  const codigo = codigoInput.trim().toUpperCase();
  const desafio = await db.desafio.findUnique({ where: { codigo }, select: { id: true, ativo: true } });
  if (!desafio || !desafio.ativo) throw new Error("Código inválido.");

  const jaMembro = await db.desafioMembro.findUnique({
    where: { desafioId_userId: { desafioId: desafio.id, userId } },
  });
  if (jaMembro) throw new Error("Você já faz parte deste desafio.");

  await db.desafioMembro.create({ data: { desafioId: desafio.id, userId } });
  revalidar(desafio.id);
  return desafio.id;
}

export async function sairDoDesafio(desafioId: string) {
  const { id: userId } = await requireUser();
  await db.desafioMembro.deleteMany({ where: { desafioId, userId } });
  await db.desafioMeta.deleteMany({ where: { desafioId, userId } });
  await reagirASaidaDeMembro(desafioId, userId);
  revalidar(desafioId);
}

export async function removerMembro(desafioId: string, membroUserId: string) {
  const { id: userId } = await requireUser();
  await requireCriador(desafioId, userId);
  if (membroUserId === userId) throw new Error("O criador não pode se remover — exclua o desafio.");
  await db.desafioMembro.deleteMany({ where: { desafioId, userId: membroUserId } });
  await db.desafioMeta.deleteMany({ where: { desafioId, userId: membroUserId } });
  await reagirASaidaDeMembro(desafioId, membroUserId);
  revalidar(desafioId);
}

export async function excluirDesafio(desafioId: string) {
  const { id: userId } = await requireUser();
  await requireCriador(desafioId, userId);
  await db.desafio.update({ where: { id: desafioId }, data: { ativo: false } });
  revalidar(desafioId);
}

export type DesafioMetaInput = {
  titulo: string;
  origem: DesafioOrigem;
  metrica?: MetaMetrica;
  rotinaTemplateId?: string;
  variavelId?: string;
  alvo: number;
  periodo: DesafioPeriodo;
};

async function validarOrigemInput(userId: string, input: DesafioMetaInput) {
  if (input.origem === "checklist") {
    if (!input.rotinaTemplateId) throw new Error("Escolha um item do checklist.");
    const template = await db.rotinaTemplate.findFirst({
      where: { id: input.rotinaTemplateId, userId },
    });
    if (!template) throw new Error("Item de checklist não encontrado.");
  }
  if (input.origem === "variavel") {
    if (!input.variavelId) throw new Error("Escolha uma variável.");
    const variavel = await db.variavel.findFirst({
      where: { id: input.variavelId, userId },
    });
    if (!variavel) throw new Error("Variável não encontrada.");
  }
}

// ---------- Aplicadores ----------
// Efeito real de cada mudança. Chamados por DOIS caminhos: direto (desafio de
// um membro só) e pela aprovação unânime de uma solicitação. Nunca são
// exportados — quem decide qual caminho seguir é registrarMudanca().

function camposDaMeta(input: DesafioMetaInput) {
  return {
    titulo: input.titulo.trim(),
    origem: input.origem,
    metrica: input.origem === "metrica" ? (input.metrica ?? null) : null,
    rotinaTemplateId: input.origem === "checklist" ? (input.rotinaTemplateId ?? null) : null,
    variavelId: input.origem === "variavel" ? (input.variavelId ?? null) : null,
    alvo: input.alvo,
    periodo: input.periodo,
  };
}

async function aplicarCriarMeta(
  userId: string,
  desafioId: string,
  input: DesafioMetaInput,
  metaPaiId: string | null
) {
  await validarOrigemInput(userId, input);

  if (metaPaiId) {
    const pai = await db.desafioMeta.findFirst({
      where: { id: metaPaiId, desafioId, userId, metaPaiId: null },
    });
    if (!pai) throw new Error("Meta grande não encontrada.");
    const count = await db.desafioMeta.count({ where: { metaPaiId } });
    await db.desafioMeta.create({
      data: { desafioId, userId, metaPaiId, ...camposDaMeta(input), ordem: count },
    });
    return;
  }

  const desafio = await db.desafio.findUnique({
    where: { id: desafioId },
    select: { metasGrandesLimite: true },
  });
  if (!desafio) throw new Error("Desafio não encontrado.");

  const count = await db.desafioMeta.count({ where: { desafioId, userId, metaPaiId: null } });
  if (count >= desafio.metasGrandesLimite) {
    throw new Error(`Limite de ${desafio.metasGrandesLimite} metas grandes atingido.`);
  }

  await db.desafioMeta.create({
    data: { desafioId, userId, ...camposDaMeta(input), ordem: count },
  });
}

async function aplicarEditarMeta(userId: string, metaId: string, input: DesafioMetaInput) {
  await validarOrigemInput(userId, input);
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");
  await db.desafioMeta.update({ where: { id: metaId }, data: camposDaMeta(input) });
}

async function aplicarExcluirMeta(userId: string, metaId: string) {
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");

  // As filhas somem por cascade (relação DesafioMetaFilhas); os ajustes não
  // têm FK, então saem daqui — junto com os das filhas.
  const filhas = await db.desafioMeta.findMany({
    where: { metaPaiId: metaId },
    select: { id: true },
  });
  await db.desafioMeta.delete({ where: { id: metaId } });
  await db.desafioAjuste.deleteMany({
    where: { metaId: { in: [metaId, ...filhas.map((f) => f.id)] } },
  });
}

async function aplicarAjuste(
  userId: string,
  desafioId: string,
  metaId: string,
  ajuste: AjusteInput,
  solicitacaoId: string | null
) {
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");
  await db.desafioAjuste.create({
    data: {
      desafioId,
      metaId,
      userId,
      quantidade: ajuste.quantidade,
      data: dataSP(ajuste.data),
      motivo: ajuste.motivo.trim(),
      solicitacaoId,
    },
  });
}

// ---------- Solicitações ----------

export type AjusteInput = {
  /** Positivo adiciona, negativo tira. Na unidade da própria meta. */
  quantidade: number;
  /** yyyy-MM-dd — o dia a que o ajuste se refere. */
  data: string;
  motivo: string;
};

/** Resultado de toda mudança em meta: aplicada na hora ou virou pedido no grupo. */
export type ResultadoMudanca = { aplicado: boolean };

function dataSP(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}

function rotuloPeriodo(periodo: string): string {
  return PERIODOS_DESAFIO.find((p) => p.value === periodo)?.label ?? periodo;
}

function unidadeDoInput(input: DesafioMetaInput): string {
  if (input.origem === "metrica" && input.metrica) {
    return METRICAS.find((m) => m.value === input.metrica)?.unidade ?? "";
  }
  if (input.origem === "variavel") return "dias";
  return "checks";
}

function numero(v: number): string {
  return v % 1 === 0 ? v.toFixed(0) : String(v);
}

function descricaoDaMeta(input: DesafioMetaInput): string {
  return `${numero(input.alvo)} ${unidadeDoInput(input)} · ${rotuloPeriodo(input.periodo)}`.trim();
}

type MetaAtual = {
  titulo: string;
  origem: string;
  metrica: string | null;
  rotinaTemplateId: string | null;
  variavelId: string | null;
  alvo: number;
  periodo: string;
};

const ROTULO_ORIGEM: Record<string, string> = {
  metrica: "métrica automática",
  checklist: "item do checklist",
  variavel: "variável pessoal",
};

/** Texto do "antes → depois" que o grupo lê antes de votar. */
function diffDaMeta(antes: MetaAtual, depois: DesafioMetaInput): string {
  const partes: string[] = [];
  if (antes.titulo !== depois.titulo.trim()) {
    partes.push(`Título: "${antes.titulo}" → "${depois.titulo.trim()}"`);
  }
  if (antes.alvo !== depois.alvo) {
    partes.push(`Alvo: ${numero(antes.alvo)} → ${numero(depois.alvo)}`);
  }
  if (antes.periodo !== depois.periodo) {
    partes.push(`Período: ${rotuloPeriodo(antes.periodo)} → ${rotuloPeriodo(depois.periodo)}`);
  }
  if (antes.origem !== depois.origem) {
    partes.push(
      `Origem: ${ROTULO_ORIGEM[antes.origem] ?? antes.origem} → ${ROTULO_ORIGEM[depois.origem] ?? depois.origem}`
    );
  } else if (
    antes.metrica !== (depois.metrica ?? null) ||
    antes.rotinaTemplateId !== (depois.rotinaTemplateId ?? null) ||
    antes.variavelId !== (depois.variavelId ?? null)
  ) {
    partes.push("Fonte do progresso trocada");
  }
  return partes.length > 0 ? partes.join(" · ") : "Sem mudança de valores";
}

/** Membros atuais do desafio — quem precisa aprovar. */
async function membrosDoDesafio(desafioId: string): Promise<string[]> {
  const membros = await db.desafioMembro.findMany({
    where: { desafioId },
    select: { userId: true },
  });
  return membros.map((m) => m.userId);
}

/**
 * Coração da regra: sozinho no desafio, aplica na hora; com outras pessoas,
 * vira solicitação pendente com o voto de aprovação do próprio autor.
 */
async function registrarMudanca(params: {
  userId: string;
  desafioId: string;
  tipo: SolicitacaoTipo;
  metaId: string | null;
  metaTitulo: string;
  payload: unknown;
  resumo: string;
  justificativa?: string;
  aplicar: () => Promise<void>;
}): Promise<ResultadoMudanca> {
  const membros = await membrosDoDesafio(params.desafioId);

  if (membros.length <= 1) {
    await params.aplicar();
    revalidar(params.desafioId);
    return { aplicado: true };
  }

  await db.desafioSolicitacao.create({
    data: {
      desafioId: params.desafioId,
      autorId: params.userId,
      tipo: params.tipo,
      metaId: params.metaId,
      metaTitulo: params.metaTitulo,
      payload: JSON.stringify(params.payload),
      resumo: params.resumo,
      justificativa: params.justificativa?.trim() || null,
      votos: { create: { userId: params.userId, aprovado: true } },
    },
  });
  revalidar(params.desafioId);
  return { aplicado: false };
}

/** Cada membro cria as PRÓPRIAS metas grandes, respeitando o limite do desafio. */
export async function criarMetaGrande(
  desafioId: string,
  input: DesafioMetaInput,
  justificativa?: string
): Promise<ResultadoMudanca> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  await validarOrigemInput(userId, input);

  const desafio = await db.desafio.findUnique({
    where: { id: desafioId },
    select: { metasGrandesLimite: true },
  });
  if (!desafio) throw new Error("Desafio não encontrado.");
  const count = await db.desafioMeta.count({ where: { desafioId, userId, metaPaiId: null } });
  if (count >= desafio.metasGrandesLimite) {
    throw new Error(`Limite de ${desafio.metasGrandesLimite} metas grandes atingido.`);
  }

  return registrarMudanca({
    userId,
    desafioId,
    tipo: "criar_meta",
    metaId: null,
    metaTitulo: input.titulo.trim(),
    payload: { meta: input, metaPaiId: null },
    resumo: `Criar a meta grande "${input.titulo.trim()}" — ${descricaoDaMeta(input)}`,
    justificativa,
    aplicar: () => aplicarCriarMeta(userId, desafioId, input, null),
  });
}

export async function criarMetaPequena(
  desafioId: string,
  metaPaiId: string,
  input: DesafioMetaInput,
  justificativa?: string
): Promise<ResultadoMudanca> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  await validarOrigemInput(userId, input);

  const pai = await db.desafioMeta.findFirst({
    where: { id: metaPaiId, desafioId, userId, metaPaiId: null },
    select: { titulo: true },
  });
  if (!pai) throw new Error("Meta grande não encontrada.");

  return registrarMudanca({
    userId,
    desafioId,
    tipo: "criar_meta",
    metaId: null,
    metaTitulo: input.titulo.trim(),
    payload: { meta: input, metaPaiId },
    resumo: `Criar a meta menor "${input.titulo.trim()}" dentro de "${pai.titulo}" — ${descricaoDaMeta(input)}`,
    justificativa,
    aplicar: () => aplicarCriarMeta(userId, desafioId, input, metaPaiId),
  });
}

export async function editarMeta(
  metaId: string,
  input: DesafioMetaInput,
  justificativa?: string
): Promise<ResultadoMudanca> {
  const { id: userId } = await requireUser();
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");
  await requireMembro(meta.desafioId, userId);
  await validarOrigemInput(userId, input);

  return registrarMudanca({
    userId,
    desafioId: meta.desafioId,
    tipo: "editar_meta",
    metaId,
    metaTitulo: meta.titulo,
    payload: { meta: input },
    resumo: `Mudar a meta "${meta.titulo}" — ${diffDaMeta(meta, input)}`,
    justificativa,
    aplicar: () => aplicarEditarMeta(userId, metaId, input),
  });
}

export async function excluirMeta(
  metaId: string,
  justificativa?: string
): Promise<ResultadoMudanca> {
  const { id: userId } = await requireUser();
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");
  await requireMembro(meta.desafioId, userId);

  const filhas = await db.desafioMeta.count({ where: { metaPaiId: metaId } });

  return registrarMudanca({
    userId,
    desafioId: meta.desafioId,
    tipo: "excluir_meta",
    metaId,
    metaTitulo: meta.titulo,
    payload: {},
    resumo:
      `Excluir a meta "${meta.titulo}" (${numero(meta.alvo)} · ${rotuloPeriodo(meta.periodo)})` +
      (filhas > 0 ? ` e as ${filhas} metas menores dentro dela` : ""),
    justificativa,
    aplicar: () => aplicarExcluirMeta(userId, metaId),
  });
}

const LIMITE_MOTIVO_AJUSTE = 200;

/**
 * Registro retroativo: "fiz o treino do dia X e esqueci de marcar" (ou o
 * contrário, tirar algo lançado a mais). Não mexe nos dados de origem — vira
 * um DesafioAjuste que só conta dentro deste desafio.
 */
export async function solicitarAjusteProgresso(
  metaId: string,
  ajuste: AjusteInput
): Promise<ResultadoMudanca> {
  const { id: userId } = await requireUser();
  const meta = await db.desafioMeta.findFirst({ where: { id: metaId, userId } });
  if (!meta) throw new Error("Meta não encontrada.");
  await requireMembro(meta.desafioId, userId);

  const quantidade = Number(ajuste.quantidade);
  if (!Number.isFinite(quantidade) || quantidade === 0) {
    throw new Error("Informe quanto quer adicionar ou tirar.");
  }
  const motivo = ajuste.motivo.trim().slice(0, LIMITE_MOTIVO_AJUSTE);
  if (!motivo) throw new Error("Explique o motivo do ajuste — o grupo precisa disso para votar.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ajuste.data)) throw new Error("Data inválida.");

  // Meta com filhas soma o progresso das filhas: um ajuste nela seria ignorado
  // no cálculo, então o pedido é barrado aqui em vez de virar um voto inútil.
  const filhas = await db.desafioMeta.count({ where: { metaPaiId: metaId } });
  if (filhas > 0) {
    throw new Error(
      "Esta meta soma o progresso das metas menores. Faça o ajuste na meta menor correspondente."
    );
  }

  const limpo: AjusteInput = { quantidade, data: ajuste.data, motivo };
  const sinal = quantidade > 0 ? "+" : "−";

  return registrarMudanca({
    userId,
    desafioId: meta.desafioId,
    tipo: "ajuste_progresso",
    metaId,
    metaTitulo: meta.titulo,
    payload: { ajuste: limpo },
    resumo: `${sinal}${numero(Math.abs(quantidade))} em "${meta.titulo}" no dia ${shortDate(dataSP(ajuste.data))}`,
    justificativa: motivo,
    aplicar: () => aplicarAjuste(userId, meta.desafioId, metaId, limpo, null),
  });
}

type PayloadSolicitacao = {
  meta?: DesafioMetaInput;
  metaPaiId?: string | null;
  ajuste?: AjusteInput;
};

/** Executa o efeito de uma solicitação aprovada por todos. */
async function aplicarSolicitacao(s: {
  id: string;
  desafioId: string;
  autorId: string;
  tipo: string;
  metaId: string | null;
  payload: string;
}) {
  const payload = JSON.parse(s.payload) as PayloadSolicitacao;

  if (s.tipo === "criar_meta") {
    if (!payload.meta) throw new Error("Pedido sem dados da meta.");
    await aplicarCriarMeta(s.autorId, s.desafioId, payload.meta, payload.metaPaiId ?? null);
    return;
  }
  if (s.tipo === "editar_meta") {
    if (!payload.meta || !s.metaId) throw new Error("Pedido sem meta de destino.");
    await aplicarEditarMeta(s.autorId, s.metaId, payload.meta);
    return;
  }
  if (s.tipo === "excluir_meta") {
    if (!s.metaId) throw new Error("Pedido sem meta de destino.");
    await aplicarExcluirMeta(s.autorId, s.metaId);
    return;
  }
  if (s.tipo === "ajuste_progresso") {
    if (!payload.ajuste || !s.metaId) throw new Error("Pedido sem dados do ajuste.");
    await aplicarAjuste(s.autorId, s.desafioId, s.metaId, payload.ajuste, s.id);
    return;
  }
  throw new Error("Tipo de solicitação desconhecido.");
}

export type ResultadoVoto = { status: "pendente" | "aprovada" | "recusada" };

/**
 * Voto de um membro. Uma recusa encerra o pedido na hora — a regra é
 * unanimidade, então não faz sentido esperar os outros votarem.
 */
export async function votarSolicitacao(
  solicitacaoId: string,
  aprovado: boolean
): Promise<ResultadoVoto> {
  const { id: userId } = await requireUser();
  const solicitacao = await db.desafioSolicitacao.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao) throw new Error("Solicitação não encontrada.");
  if (solicitacao.status !== "pendente") throw new Error("Esta solicitação já foi encerrada.");
  await requireMembro(solicitacao.desafioId, userId);

  await db.desafioSolicitacaoVoto.upsert({
    where: { solicitacaoId_userId: { solicitacaoId, userId } },
    create: { solicitacaoId, userId, aprovado },
    update: { aprovado },
  });

  if (!aprovado) {
    await db.desafioSolicitacao.update({
      where: { id: solicitacaoId },
      data: { status: "recusada", resolvidoEm: new Date() },
    });
    revalidar(solicitacao.desafioId);
    return { status: "recusada" };
  }

  const concluida = await concluirSeUnanime(solicitacao.id);
  revalidar(solicitacao.desafioId);
  return { status: concluida ? "aprovada" : "pendente" };
}

/**
 * Aplica a solicitação se todos os membros ATUAIS já aprovaram. Roda depois de
 * cada voto e também quando alguém sai do desafio — sem isso um pedido que só
 * esperava o voto de quem saiu ficaria pendente para sempre.
 */
async function concluirSeUnanime(solicitacaoId: string): Promise<boolean> {
  const solicitacao = await db.desafioSolicitacao.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao || solicitacao.status !== "pendente") return false;

  const [membros, votos] = await Promise.all([
    membrosDoDesafio(solicitacao.desafioId),
    db.desafioSolicitacaoVoto.findMany({ where: { solicitacaoId } }),
  ]);
  const aprovadores = new Set(votos.filter((v) => v.aprovado).map((v) => v.userId));
  if (membros.length === 0 || !membros.every((id) => aprovadores.has(id))) return false;

  try {
    await aplicarSolicitacao(solicitacao);
  } catch (e) {
    await db.desafioSolicitacao.update({
      where: { id: solicitacaoId },
      data: { status: "recusada", resolvidoEm: new Date() },
    });
    const motivo = e instanceof Error ? e.message : "erro desconhecido";
    throw new Error(
      `Todos aprovaram, mas a mudança não pôde ser aplicada: ${motivo} O pedido foi encerrado.`
    );
  }

  await db.desafioSolicitacao.update({
    where: { id: solicitacaoId },
    data: { status: "aprovada", resolvidoEm: new Date() },
  });
  return true;
}

/**
 * Quando um membro sai: cancela os pedidos dele e reavalia os que sobraram —
 * o voto de quem saiu deixa de ser necessário.
 */
async function reagirASaidaDeMembro(desafioId: string, userIdQueSaiu: string) {
  await db.desafioSolicitacao.updateMany({
    where: { desafioId, autorId: userIdQueSaiu, status: "pendente" },
    data: { status: "cancelada", resolvidoEm: new Date() },
  });
  await db.desafioAjuste.deleteMany({ where: { desafioId, userId: userIdQueSaiu } });

  const pendentes = await db.desafioSolicitacao.findMany({
    where: { desafioId, status: "pendente" },
    select: { id: true },
  });
  for (const p of pendentes) {
    // Uma falha de aplicação não pode impedir as outras de serem avaliadas.
    try {
      await concluirSeUnanime(p.id);
    } catch {
      // concluirSeUnanime já encerrou o pedido como recusado.
    }
  }
}

/** O autor pode retirar o próprio pedido enquanto ninguém encerrou. */
export async function cancelarSolicitacao(solicitacaoId: string) {
  const { id: userId } = await requireUser();
  const solicitacao = await db.desafioSolicitacao.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao) throw new Error("Solicitação não encontrada.");
  if (solicitacao.autorId !== userId) throw new Error("Só quem pediu pode cancelar.");
  if (solicitacao.status !== "pendente") throw new Error("Esta solicitação já foi encerrada.");

  await db.desafioSolicitacao.update({
    where: { id: solicitacaoId },
    data: { status: "cancelada", resolvidoEm: new Date() },
  });
  revalidar(solicitacao.desafioId);
}

/** Lista atual de solicitações — usada pelo card após cada voto. */
export async function buscarSolicitacoes(desafioId: string): Promise<SolicitacaoView[]> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return solicitacoesDoDesafio(desafioId, userId);
}

/**
 * Detalhe atual do desafio (metas + progresso de todos os membros) — usado
 * pelo cliente da página via polling, pra refletir aprovações de outros
 * membros sem depender de um reload manual da aba de quem está esperando.
 */
export async function buscarDesafioDetalhe(desafioId: string): Promise<DesafioDetalhe | null> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return desafioDetalhe(desafioId);
}

const LIMITE_TEXTO_MENSAGEM = 500;

/** Envia uma mensagem no chat do desafio. Só membros podem escrever. */
export async function enviarMensagem(desafioId: string, texto: string) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const limpo = texto.trim().slice(0, LIMITE_TEXTO_MENSAGEM);
  if (!limpo) throw new Error("Escreva uma mensagem.");

  await db.desafioMensagem.create({ data: { desafioId, userId, texto: limpo } });
  revalidatePath(`/desafios/${desafioId}`);
}

/** Busca as mensagens atuais — usado pelo cliente de chat via polling. */
export async function buscarMensagens(desafioId: string): Promise<MensagemView[]> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return mensagensDoDesafio(desafioId);
}

const TIPOS_DOCUMENTO_ACEITOS = ["application/pdf", "image/png", "image/jpeg"];
const TAMANHO_MAX_DOCUMENTO = 25 * 1024 * 1024; // 25MB

/** Sobe (ou substitui) o documento fixado do desafio — "o contrato do grupo". Qualquer membro pode enviar. */
export async function enviarDocumento(desafioId: string, formData: FormData): Promise<void> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const nomeLimpo = String(formData.get("nome") ?? "").trim().slice(0, 80);
  const file = formData.get("file");
  if (!nomeLimpo) throw new Error("Dê um nome ao documento.");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo.");
  }
  if (!TIPOS_DOCUMENTO_ACEITOS.includes(file.type)) {
    throw new Error("Formato inválido. Envie um PDF, JPG ou PNG.");
  }
  if (file.size > TAMANHO_MAX_DOCUMENTO) {
    throw new Error("Arquivo muito grande. Limite de 25MB.");
  }

  const arquivoUrl = await uploadDesafioDocumento(desafioId, file);

  await db.desafioDocumento.upsert({
    where: { desafioId },
    create: { desafioId, nome: nomeLimpo, arquivoUrl, arquivoTipo: file.type, enviadoPorId: userId },
    update: { nome: nomeLimpo, arquivoUrl, arquivoTipo: file.type, enviadoPorId: userId },
  });
  revalidar(desafioId);
}

/** Busca o documento fixado atual — usado pelo cliente após upload. */
export async function buscarDocumento(desafioId: string): Promise<DesafioDocumentoView | null> {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);
  return documentoDoDesafio(desafioId);
}

/** Remove o documento fixado. Só o criador do desafio ou quem enviou pode excluir. */
export async function excluirDocumento(desafioId: string) {
  const { id: userId } = await requireUser();
  await requireMembro(desafioId, userId);

  const doc = await db.desafioDocumento.findUnique({ where: { desafioId } });
  if (!doc) return;
  if (doc.enviadoPorId !== userId) {
    await requireCriador(desafioId, userId);
  }

  await db.desafioDocumento.delete({ where: { desafioId } });
  await removeDesafioDocumento(desafioId);
  revalidar(desafioId);
}
