/**
 * Seed do LC — dados realistas em pt-BR (junho/julho 2026).
 * Roda com: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// R$ → centavos
const r = (reais: number) => Math.round(reais * 100);
// Data em America/Sao_Paulo (Brasil sem horário de verão: -03:00 fixo)
const pad = (n: number) => String(n).padStart(2, "0");
const sp = (mes: number, dia: number, h = 12, min = 0, ano = 2026) =>
  new Date(`${ano}-${pad(mes)}-${pad(dia)}T${pad(h)}:${pad(min)}:00-03:00`);
const spDay = (mes: number, dia: number, ano = 2026) => sp(mes, dia, 0, 0, ano);

async function main() {
  console.log("🌊  Semeando os dados LC...");

  // limpar tudo (ordem respeita FKs)
  await db.setLog.deleteMany();
  await db.workoutSession.deleteMany();
  await db.routineExercise.deleteMany();
  await db.routine.deleteMany();
  await db.run.deleteMany();
  await db.mealItem.deleteMany();
  await db.meal.deleteMany();
  await db.diet.deleteMany();
  await db.food.deleteMany();
  await db.dietDayLog.deleteMany();
  await db.weightLog.deleteMany();
  await db.eventNote.deleteMany();
  await db.event.deleteMany();
  await db.calendar.deleteMany();
  await db.holiday.deleteMany();
  await db.assetMovement.deleteMany();
  await db.asset.deleteMany();
  await db.transaction.deleteMany();
  await db.subscription.deleteMany();
  await db.card.deleteMany();
  await db.category.deleteMany();
  await db.account.deleteMany();
  await db.goal.deleteMany();
  await db.setting.deleteMany();

  // ---------- Contas ----------
  const inter = await db.account.create({
    data: {
      nome: "Inter",
      tipo: "corrente",
      cor: "#F5B14C",
      saldoInicial: r(595.5),
    },
  });
  const carteira = await db.account.create({
    data: {
      nome: "Carteira",
      tipo: "poupanca",
      cor: "#6B96D6",
      saldoInicial: 0,
    },
  });

  // ---------- Categorias ----------
  const cat = async (
    nome: string,
    emoji: string,
    cor: string,
    tipo: "despesa" | "receita",
    orcamentoMensal?: number
  ) =>
    db.category.create({
      data: { nome, emoji, cor, tipo, orcamentoMensal },
    });

  const telecom = await cat("Telecomunicação", "🏠", "#FF6B6B", "despesa", r(300));
  const mercado = await cat("Mercado", "🛒", "#0d6efd", "despesa", r(900));
  const transporte = await cat("Transporte", "🚗", "#6B96D6", "despesa", r(400));
  const ifood = await cat("iFood", "🍔", "#F5B14C", "despesa", r(300));
  const lazer = await cat("Lazer", "🎮", "#A78BDB", "despesa", r(250));
  const saude = await cat("Saúde", "💊", "#4EC9C0", "despesa", r(300));
  const estudos = await cat("Estudos", "📚", "#4E6A9C", "despesa", r(200));
  const salario = await cat("Salário", "💼", "#0d6efd", "receita");
  const rendimentos = await cat("Rendimentos", "📈", "#4EC9C0", "receita");

  // ---------- Assinaturas ----------
  await db.subscription.createMany({
    data: [
      { nome: "Spotify", emoji: "🎧", valor: r(21.9), diaCobranca: 10, status: "ativa" },
      { nome: "Netflix", emoji: "🎬", valor: r(44.9), diaCobranca: 15, status: "ativa", valorAnterior: r(39.9) },
      { nome: "Academia Panobianco", emoji: "🏋️", valor: r(129.9), diaCobranca: 5, status: "ativa" },
    ],
  });

  // ---------- Transações (jun + jul/2026) ----------
  type Tx = {
    tipo: "despesa" | "receita";
    valor: number;
    data: Date;
    descricao: string;
    categoryId: string | null;
    tags?: string[];
    recorrente?: boolean;
    parcelaGrupo?: string;
    parcelaNum?: number;
    parcelaTotal?: number;
    paga?: boolean;
  };

  const txs: Tx[] = [];
  const t = (
    tipo: "despesa" | "receita",
    valor: number,
    data: Date,
    descricao: string,
    categoryId: string | null,
    extra: Partial<Tx> = {}
  ) => txs.push({ tipo, valor, data, descricao, categoryId, ...extra });

  // --- JUNHO ---
  t("receita", r(4200), sp(6, 5, 9), "Salário", salario.id, { recorrente: true });
  t("receita", r(32.4), sp(6, 28, 18), "Rendimento CDB", rendimentos.id);
  // Telecomunicação junho: R$ 267,00
  t("despesa", r(99.9), sp(6, 8, 10), "Internet fibra 500mb", telecom.id, { recorrente: true });
  t("despesa", r(167.1), sp(6, 12, 14), "Plano celular + franquia", telecom.id, { recorrente: true });
  // Mercado
  t("despesa", r(238.4), sp(6, 3, 19), "Compra do mês · Assaí", mercado.id);
  t("despesa", r(96.75), sp(6, 10, 20), "Feira + açougue", mercado.id);
  t("despesa", r(142.3), sp(6, 17, 19), "Mercado semanal", mercado.id);
  t("despesa", r(58.9), sp(6, 24, 21), "Padaria + frios", mercado.id);
  // Transporte
  t("despesa", r(180), sp(6, 6, 8), "Gasolina", transporte.id);
  t("despesa", r(24.9), sp(6, 11, 22), "Uber · volta do centro", transporte.id);
  t("despesa", r(19.5), sp(6, 14, 23), "Uber", transporte.id);
  t("despesa", r(160), sp(6, 20, 9), "Gasolina", transporte.id);
  t("despesa", r(31.2), sp(6, 27, 22), "Uber · aniversário", transporte.id);
  // iFood
  t("despesa", r(42.5), sp(6, 4, 20), "iFood · japonês", ifood.id);
  t("despesa", r(35.9), sp(6, 13, 21), "iFood · burger", ifood.id);
  t("despesa", r(52.8), sp(6, 19, 20), "iFood · pizza", ifood.id);
  t("despesa", r(38.4), sp(6, 26, 21), "iFood · marmita fit", ifood.id);
  // Lazer / Saúde / Estudos
  t("despesa", r(64), sp(6, 21, 16), "Cinema + pipoca", lazer.id);
  t("despesa", r(89.9), sp(6, 15, 11), "Suplemento creatina", saude.id);
  t("despesa", r(59.9), sp(6, 9, 10), "Curso de inglês · material", estudos.id);
  // Assinaturas junho
  t("despesa", r(129.9), sp(6, 5, 7), "Academia Panobianco", saude.id, { recorrente: true });
  t("despesa", r(21.9), sp(6, 10, 7), "Spotify", lazer.id, { recorrente: true });
  t("despesa", r(39.9), sp(6, 15, 7), "Netflix", lazer.id, { recorrente: true });

  // --- JULHO (até dia 16) ---
  t("receita", r(4200), sp(7, 5, 9), "Salário", salario.id, { recorrente: true });
  t("receita", r(35.2), sp(7, 15, 18), "Rendimento CDB", rendimentos.id);
  // Telecomunicação julho: R$ 572,45 (+114,4% vs junho)
  t("despesa", r(99.9), sp(7, 8, 10), "Internet fibra 500mb", telecom.id, { recorrente: true });
  t("despesa", r(167.1), sp(7, 12, 14), "Plano celular + franquia", telecom.id, { recorrente: true });
  t("despesa", r(305.45), sp(7, 13, 15), "Roteador novo + instalação ponto extra", telecom.id);
  // Mercado
  t("despesa", r(219.6), sp(7, 2, 19), "Compra do mês · Assaí", mercado.id);
  t("despesa", r(88.3), sp(7, 9, 20), "Feira + açougue", mercado.id);
  t("despesa", r(131.45), sp(7, 15, 19), "Mercado semanal", mercado.id);
  // Transporte
  t("despesa", r(175), sp(7, 4, 8), "Gasolina", transporte.id);
  t("despesa", r(22.4), sp(7, 7, 22), "Uber", transporte.id);
  t("despesa", r(27.8), sp(7, 11, 23), "Uber · show", transporte.id);
  t("despesa", r(16.9), sp(7, 14, 21), "Estacionamento shopping", transporte.id);
  // iFood
  t("despesa", r(47.6), sp(7, 3, 20), "iFood · japonês", ifood.id);
  t("despesa", r(33.9), sp(7, 8, 21), "iFood · burger", ifood.id);
  t("despesa", r(41.2), sp(7, 12, 20), "iFood · poke", ifood.id);
  t("despesa", r(36.8), sp(7, 15, 21), "iFood · marmita fit", ifood.id);
  // Lazer / Saúde / Estudos
  t("despesa", r(58), sp(7, 11, 20), "Show · entrada + cerveja", lazer.id);
  t("despesa", r(72.5), sp(7, 6, 10), "Whey protein 900g", saude.id);
  t("despesa", r(59.9), sp(7, 9, 10), "Curso de inglês · mensalidade", estudos.id, { recorrente: true });
  // Assinaturas julho (Netflix subiu de 39,90 → 44,90)
  t("despesa", r(129.9), sp(7, 5, 7), "Academia Panobianco", saude.id, { recorrente: true });
  t("despesa", r(21.9), sp(7, 10, 7), "Spotify", lazer.id, { recorrente: true });
  t("despesa", r(44.9), sp(7, 15, 7), "Netflix", lazer.id, { recorrente: true });

  // --- Parcelamento: Fone Bluetooth JBL em 10x de R$ 89,90 (desde maio) ---
  for (let n = 1; n <= 10; n++) {
    const mesTotal = 5 + (n - 1); // maio = parcela 1
    const ano = mesTotal > 12 ? 2027 : 2026;
    const mes = mesTotal > 12 ? mesTotal - 12 : mesTotal;
    t("despesa", r(89.9), sp(mes, 10, 12, 0, ano), "Fone Bluetooth JBL", lazer.id, {
      parcelaGrupo: "parc-fone-jbl",
      parcelaNum: n,
      parcelaTotal: 10,
      paga: sp(mes, 10, 12, 0, ano) <= sp(7, 16),
    });
  }

  for (const tx of txs) {
    await db.transaction.create({
      data: {
        tipo: tx.tipo,
        valor: tx.valor,
        data: tx.data,
        descricao: tx.descricao,
        categoryId: tx.categoryId,
        accountId: inter.id,
        tags: JSON.stringify(tx.tags ?? []),
        recorrente: tx.recorrente ?? false,
        parcelaGrupo: tx.parcelaGrupo,
        parcelaNum: tx.parcelaNum,
        parcelaTotal: tx.parcelaTotal,
        paga: tx.paga ?? true,
      },
    });
  }
  console.log(`💸 ${txs.length} transações criadas`);

  // ---------- Investimentos ----------
  const cdb = await db.asset.create({
    data: { nome: "CDB 110% CDI", classe: "Renda Fixa", instituicao: "Inter", cor: "#0d6efd" },
  });
  const selic = await db.asset.create({
    data: { nome: "Tesouro Selic 2029", classe: "Tesouro", instituicao: "Tesouro Direto", cor: "#4EC9C0" },
  });
  const fii = await db.asset.create({
    data: { nome: "HGLG11", classe: "FIIs", instituicao: "XP Investimentos", cor: "#6B96D6" },
  });
  const btc = await db.asset.create({
    data: { nome: "Bitcoin", classe: "Cripto", instituicao: "Binance", cor: "#F5B14C" },
  });

  // aportes mensais (fev→jul) + atualização de valor no fim de cada mês
  const movimentos: { assetId: string; tipo: string; valor: number; data: Date }[] = [];
  const plano = [
    { asset: cdb, aporte: 500, curva: [505, 1022, 1551, 2094, 2652, 3228] },
    { asset: selic, aporte: 300, curva: [302, 610, 923, 1243, 1570, 1905] },
    { asset: fii, aporte: 400, curva: [396, 812, 1218, 1660, 2085, 2540] },
    { asset: btc, aporte: 200, curva: [214, 389, 662, 801, 1090, 1284] },
  ];
  for (const { asset, aporte, curva } of plano) {
    for (let i = 0; i < 6; i++) {
      const mes = 2 + i; // fev..jul
      movimentos.push({
        assetId: asset.id,
        tipo: "aporte",
        valor: r(aporte),
        data: sp(mes, 5, 10),
      });
      // atualização de valor total: fim do mês (julho: dia 15, mês corrente)
      const diaAtt = mes === 7 ? 15 : 28;
      movimentos.push({
        assetId: asset.id,
        tipo: "atualizacao",
        valor: r(curva[i]),
        data: sp(mes, diaAtt, 18),
      });
    }
  }
  await db.assetMovement.createMany({ data: movimentos });
  console.log(`📈 4 ativos + ${movimentos.length} movimentos`);

  // ---------- Dieta ----------
  const foods = {
    ovo: await db.food.create({ data: { nome: "Ovo inteiro", kcal100: 143, prot100: 12.6, carb100: 0.7, gord100: 9.5, porcaoNome: "1 unidade", porcaoG: 50 } }),
    aveia: await db.food.create({ data: { nome: "Aveia em flocos", kcal100: 389, prot100: 16.9, carb100: 66.3, gord100: 6.9 } }),
    banana: await db.food.create({ data: { nome: "Banana prata", kcal100: 89, prot100: 1.1, carb100: 22.8, gord100: 0.3, porcaoNome: "1 unidade", porcaoG: 70 } }),
    whey: await db.food.create({ data: { nome: "Whey protein", kcal100: 400, prot100: 80, carb100: 8, gord100: 6, porcaoNome: "1 scoop", porcaoG: 30 } }),
    arroz: await db.food.create({ data: { nome: "Arroz branco cozido", kcal100: 128, prot100: 2.5, carb100: 28.1, gord100: 0.2 } }),
    feijao: await db.food.create({ data: { nome: "Feijão carioca cozido", kcal100: 76, prot100: 4.8, carb100: 13.6, gord100: 0.5 } }),
    frango: await db.food.create({ data: { nome: "Peito de frango grelhado", kcal100: 165, prot100: 31, carb100: 0, gord100: 3.6 } }),
    batataDoce: await db.food.create({ data: { nome: "Batata-doce cozida", kcal100: 86, prot100: 1.6, carb100: 20.1, gord100: 0.1 } }),
    azeite: await db.food.create({ data: { nome: "Azeite de oliva", kcal100: 884, prot100: 0, carb100: 0, gord100: 100, porcaoNome: "1 colher", porcaoG: 13 } }),
    paoIntegral: await db.food.create({ data: { nome: "Pão integral", kcal100: 253, prot100: 12, carb100: 43, gord100: 3.5, porcaoNome: "1 fatia", porcaoG: 30 } }),
    iogurte: await db.food.create({ data: { nome: "Iogurte natural desnatado", kcal100: 42, prot100: 4.7, carb100: 5.6, gord100: 0.2 } }),
    tilapia: await db.food.create({ data: { nome: "Filé de tilápia", kcal100: 96, prot100: 20.1, carb100: 0, gord100: 1.7 } }),
    brocolis: await db.food.create({ data: { nome: "Brócolis cozido", kcal100: 35, prot100: 2.4, carb100: 7.2, gord100: 0.4 } }),
    castanha: await db.food.create({ data: { nome: "Castanha-de-caju", kcal100: 570, prot100: 18.5, carb100: 29.1, gord100: 46.3 } }),
  };

  const diet = await db.diet.create({
    data: {
      nome: "Cutting 2.200 kcal",
      ativa: true,
      metaKcal: 2200,
      metaProt: 170,
      metaCarb: 210,
      metaGord: 60,
    },
  });

  const mkMeal = async (
    nome: string,
    horario: string,
    ordem: number,
    items: { food: { id: string }; quantidade: number; unidade?: string }[]
  ) => {
    const meal = await db.meal.create({
      data: { nome, horario, ordem, dietId: diet.id },
    });
    for (const it of items) {
      await db.mealItem.create({
        data: {
          mealId: meal.id,
          foodId: it.food.id,
          quantidade: it.quantidade,
          unidade: it.unidade ?? "g",
        },
      });
    }
    return meal;
  };

  const cafe = await mkMeal("Café da manhã", "07:00", 0, [
    { food: foods.ovo, quantidade: 3, unidade: "porcao" },
    { food: foods.aveia, quantidade: 50 },
    { food: foods.banana, quantidade: 1, unidade: "porcao" },
  ]);
  const almoco = await mkMeal("Almoço", "12:30", 1, [
    { food: foods.arroz, quantidade: 200 },
    { food: foods.feijao, quantidade: 100 },
    { food: foods.frango, quantidade: 180 },
    { food: foods.brocolis, quantidade: 100 },
    { food: foods.azeite, quantidade: 1, unidade: "porcao" },
  ]);
  const lanche = await mkMeal("Lanche da tarde", "16:00", 2, [
    { food: foods.whey, quantidade: 1, unidade: "porcao" },
    { food: foods.paoIntegral, quantidade: 2, unidade: "porcao" },
    { food: foods.castanha, quantidade: 20 },
  ]);
  const jantar = await mkMeal("Jantar", "20:00", 3, [
    { food: foods.batataDoce, quantidade: 200 },
    { food: foods.tilapia, quantidade: 200 },
    { food: foods.brocolis, quantidade: 100 },
  ]);
  const ceia = await mkMeal("Ceia", "22:30", 4, [
    { food: foods.iogurte, quantidade: 200 },
    { food: foods.castanha, quantidade: 15 },
  ]);

  // 10 dias de diário (7–16 de julho)
  const mealIds = [cafe.id, almoco.id, lanche.id, jantar.id, ceia.id];
  for (let dia = 7; dia <= 16; dia++) {
    const cumpre =
      dia === 12
        ? mealIds.slice(0, 3) // domingo: furou o plano
        : dia === 16
          ? mealIds.slice(0, 2) // hoje: dia em andamento
          : mealIds.slice(0, 4 + (dia % 2)); // 4 ou 5 refeições
    await db.dietDayLog.create({
      data: {
        data: spDay(7, dia),
        refeicoesCumpridas: JSON.stringify(cumpre),
        extras:
          dia === 11
            ? JSON.stringify([{ nome: "Açaí 300ml", kcal: 380, prot: 5, carb: 72, gord: 8 }])
            : "[]",
        aguaMl: dia === 16 ? 1500 : 2250 + (dia % 3) * 250,
        notas: dia === 12 ? "Almoço de família, saí do plano no jantar." : null,
      },
    });
  }

  // 8 registros de peso (1–16 de julho, tendência de queda)
  const pesos = [84.2, 84.0, 83.8, 83.9, 83.5, 83.4, 83.1, 82.9];
  const diasPeso = [1, 3, 5, 7, 9, 11, 14, 16];
  for (let i = 0; i < pesos.length; i++) {
    await db.weightLog.create({
      data: {
        data: spDay(7, diasPeso[i]),
        pesoKg: pesos[i],
        cintura: i % 2 === 0 ? 88 - i * 0.3 : null,
      },
    });
  }
  console.log("🥗 Dieta ativa + 10 diários + 8 pesos");

  // ---------- Treinos ----------
  const fichaA = await db.routine.create({ data: { nome: "Ficha A", foco: "Peito, ombro e tríceps", ordem: 0 } });
  const fichaB = await db.routine.create({ data: { nome: "Ficha B", foco: "Costas e bíceps", ordem: 1 } });
  const fichaC = await db.routine.create({ data: { nome: "Ficha C", foco: "Pernas e panturrilha", ordem: 2 } });

  const mkEx = (
    routineId: string,
    nome: string,
    grupoMuscular: string,
    series: number,
    repsAlvo: string,
    cargaAtual: number,
    descansoSeg: number,
    ordem: number,
    observacao?: string
  ) =>
    db.routineExercise.create({
      data: { routineId, nome, grupoMuscular, series, repsAlvo, cargaAtual, descansoSeg, ordem, observacao },
    });

  const supino = await mkEx(fichaA.id, "Supino reto barra", "Peito", 4, "8-10", 62.5, 120, 0, "Escápulas retraídas, pausa no peito");
  const inclinado = await mkEx(fichaA.id, "Supino inclinado halteres", "Peito", 3, "10-12", 26, 90, 1);
  const crucifixo = await mkEx(fichaA.id, "Crucifixo máquina", "Peito", 3, "12-15", 55, 60, 2);
  const desenvolvimento = await mkEx(fichaA.id, "Desenvolvimento halteres", "Ombro", 4, "8-10", 22, 90, 3);
  const lateral = await mkEx(fichaA.id, "Elevação lateral", "Ombro", 3, "12-15", 10, 60, 4, "Sem balanço");
  const testa = await mkEx(fichaA.id, "Tríceps testa", "Tríceps", 3, "10-12", 30, 90, 5);
  const corda = await mkEx(fichaA.id, "Tríceps corda", "Tríceps", 3, "12-15", 27.5, 60, 6);

  const puxada = await mkEx(fichaB.id, "Puxada frente", "Costas", 4, "8-10", 72.5, 120, 0);
  const remadaCurvada = await mkEx(fichaB.id, "Remada curvada", "Costas", 4, "8-10", 62.5, 120, 1, "Tronco 45°");
  const remadaBaixa = await mkEx(fichaB.id, "Remada baixa triângulo", "Costas", 3, "10-12", 67.5, 90, 2);
  const roscaDireta = await mkEx(fichaB.id, "Rosca direta barra W", "Bíceps", 3, "8-10", 32.5, 90, 3);
  const roscaMartelo = await mkEx(fichaB.id, "Rosca martelo", "Bíceps", 3, "10-12", 14, 60, 4);

  const agacho = await mkEx(fichaC.id, "Agachamento livre", "Pernas", 4, "6-8", 85, 180, 0, "Profundidade abaixo da paralela");
  const legPress = await mkEx(fichaC.id, "Leg press 45°", "Pernas", 4, "10-12", 210, 120, 1);
  const extensora = await mkEx(fichaC.id, "Cadeira extensora", "Pernas", 3, "12-15", 55, 60, 2);
  const flexora = await mkEx(fichaC.id, "Mesa flexora", "Pernas", 3, "10-12", 47.5, 90, 3);
  const panturrilha = await mkEx(fichaC.id, "Panturrilha em pé", "Panturrilha", 4, "12-15", 90, 60, 4);

  // 10 sessões (22/jun → 15/jul) com progressão de carga
  const agenda10: { data: Date; ficha: typeof fichaA; dur: number }[] = [
    { data: sp(6, 22, 18), ficha: fichaA, dur: 62 },
    { data: sp(6, 24, 18), ficha: fichaB, dur: 58 },
    { data: sp(6, 26, 18), ficha: fichaC, dur: 71 },
    { data: sp(6, 29, 18), ficha: fichaA, dur: 65 },
    { data: sp(7, 1, 18), ficha: fichaB, dur: 60 },
    { data: sp(7, 3, 18), ficha: fichaC, dur: 68 },
    { data: sp(7, 6, 18), ficha: fichaA, dur: 63 },
    { data: sp(7, 8, 18), ficha: fichaB, dur: 57 },
    { data: sp(7, 10, 18), ficha: fichaC, dur: 74 },
    { data: sp(7, 15, 18), ficha: fichaA, dur: 66 },
  ];

  const exsByFicha: Record<string, { ex: { id: string }; base: number; inc: number; reps: number; series: number }[]> = {
    [fichaA.id]: [
      { ex: supino, base: 57.5, inc: 2.5, reps: 9, series: 4 },
      { ex: inclinado, base: 24, inc: 1, reps: 11, series: 3 },
      { ex: crucifixo, base: 50, inc: 2.5, reps: 13, series: 3 },
      { ex: desenvolvimento, base: 20, inc: 1, reps: 9, series: 4 },
      { ex: lateral, base: 9, inc: 0.5, reps: 14, series: 3 },
      { ex: testa, base: 27.5, inc: 1.25, reps: 11, series: 3 },
      { ex: corda, base: 25, inc: 1.25, reps: 13, series: 3 },
    ],
    [fichaB.id]: [
      { ex: puxada, base: 67.5, inc: 2.5, reps: 9, series: 4 },
      { ex: remadaCurvada, base: 57.5, inc: 2.5, reps: 9, series: 4 },
      { ex: remadaBaixa, base: 62.5, inc: 2.5, reps: 11, series: 3 },
      { ex: roscaDireta, base: 30, inc: 1.25, reps: 9, series: 3 },
      { ex: roscaMartelo, base: 12, inc: 1, reps: 11, series: 3 },
    ],
    [fichaC.id]: [
      { ex: agacho, base: 77.5, inc: 2.5, reps: 7, series: 4 },
      { ex: legPress, base: 195, inc: 5, reps: 11, series: 4 },
      { ex: extensora, base: 50, inc: 2.5, reps: 13, series: 3 },
      { ex: flexora, base: 42.5, inc: 2.5, reps: 11, series: 3 },
      { ex: panturrilha, base: 85, inc: 2.5, reps: 13, series: 4 },
    ],
  };

  const vezesFicha: Record<string, number> = {};
  for (const s of agenda10) {
    const vez = vezesFicha[s.ficha.id] ?? 0;
    vezesFicha[s.ficha.id] = vez + 1;
    const session = await db.workoutSession.create({
      data: { data: s.data, duracaoMin: s.dur, routineId: s.ficha.id, concluida: true },
    });
    for (const cfg of exsByFicha[s.ficha.id]) {
      const carga = cfg.base + cfg.inc * vez;
      for (let serie = 1; serie <= cfg.series; serie++) {
        await db.setLog.create({
          data: {
            sessionId: session.id,
            exerciseId: cfg.ex.id,
            serie,
            reps: Math.max(4, cfg.reps - (serie === cfg.series ? 1 : 0)),
            cargaKg: carga,
          },
        });
      }
    }
  }

  // 8 corridas (20/jun → 14/jul)
  const runs = [
    { data: sp(6, 20, 7), km: 5.0, segundos: 31 * 60 + 10, tipo: "Leve", sensacao: 4 },
    { data: sp(6, 23, 6, 30), km: 6.2, segundos: 36 * 60 + 45, tipo: "Moderado", sensacao: 3 },
    { data: sp(6, 27, 7), km: 10.0, segundos: 62 * 60 + 30, tipo: "Longão", sensacao: 4, notas: "Melhor longão do mês" },
    { data: sp(6, 30, 6, 30), km: 5.0, segundos: 29 * 60 + 50, tipo: "Moderado", sensacao: 5, notas: "PR nos 5k!" },
    { data: sp(7, 4, 7), km: 6.0, segundos: 34 * 60 + 20, tipo: "Intervalado", sensacao: 3 },
    { data: sp(7, 7, 6, 30), km: 5.2, segundos: 31 * 60 + 40, tipo: "Leve", sensacao: 4 },
    { data: sp(7, 11, 7), km: 12.0, segundos: 76 * 60 + 15, tipo: "Longão", sensacao: 4 },
    { data: sp(7, 14, 6, 30), km: 5.0, segundos: 30 * 60 + 5, tipo: "Moderado", sensacao: 4 },
  ];
  for (const run of runs) {
    await db.run.create({ data: { ...run, notas: run.notas ?? null } });
  }
  console.log("🏋️ 3 fichas + 10 sessões + 8 corridas");

  // ---------- Agenda ----------
  const calPessoal = await db.calendar.create({ data: { nome: "Pessoal", cor: "#6B96D6", ordem: 0 } });
  const calTreinos = await db.calendar.create({ data: { nome: "Treinos", cor: "#0d6efd", ordem: 1 } });
  const calDieta = await db.calendar.create({ data: { nome: "Dieta", cor: "#F5B14C", ordem: 2 } });
  const calFinancas = await db.calendar.create({ data: { nome: "Finanças", cor: "#FF6B6B", ordem: 3 } });
  const calEstudos = await db.calendar.create({ data: { nome: "Estudos", cor: "#4EC9C0", ordem: 4 } });
  await db.calendar.create({ data: { nome: "Feriados no Brasil", cor: "#A78BDB", readonly: true, ordem: 5 } });

  const ingles = await db.event.create({
    data: {
      titulo: "INGLÊS",
      inicio: sp(6, 5, 10),
      fim: sp(6, 5, 11),
      calendarId: calEstudos.id,
      rrule: JSON.stringify({ freq: "weekly", byday: [5] }),
      lembreteMin: 30,
      local: "Wizard · Sala 3",
      descricao: "Aula regular de inglês",
      tags: JSON.stringify(["estudo", "prioridade"]),
    },
  });
  await db.eventNote.create({
    data: {
      eventId: ingles.id,
      texto: "Aula de sexta passada foi sobre phrasal verbs — revisar antes da próxima.",
      criadoEm: sp(7, 10, 11, 15),
    },
  });

  await db.event.create({
    data: {
      titulo: "Todo Mundo em Pânico · Kinoplex",
      inicio: sp(7, 16, 18, 50),
      fim: sp(7, 16, 21, 0),
      calendarId: calPessoal.id,
      lembreteMin: 60,
      local: "Kinoplex · Shopping",
      tags: JSON.stringify(["cinema"]),
    },
  });

  await db.event.create({
    data: {
      titulo: "Aniversário pai",
      inicio: spDay(7, 21),
      fim: spDay(7, 21),
      diaInteiro: true,
      calendarId: calPessoal.id,
      rrule: JSON.stringify({ freq: "yearly" }),
      lembreteMin: 24 * 60,
    },
  });

  await db.event.create({
    data: {
      titulo: "Treino · Musculação",
      inicio: sp(6, 1, 18),
      fim: sp(6, 1, 19, 30),
      calendarId: calTreinos.id,
      rrule: JSON.stringify({ freq: "weekly", byday: [1, 3, 5] }),
      local: "Academia Panobianco",
    },
  });

  await db.event.create({
    data: {
      titulo: "Corrida leve",
      inicio: sp(6, 6, 7),
      fim: sp(6, 6, 8),
      calendarId: calTreinos.id,
      rrule: JSON.stringify({ freq: "weekly", byday: [6] }),
    },
  });

  await db.event.create({
    data: {
      titulo: "Prep de refeições da semana",
      inicio: sp(7, 19, 16),
      fim: sp(7, 19, 18),
      calendarId: calDieta.id,
      rrule: JSON.stringify({ freq: "weekly", byday: [0] }),
    },
  });

  await db.event.create({
    data: {
      titulo: "Vencimento fatura Inter",
      inicio: spDay(7, 20),
      fim: spDay(7, 20),
      diaInteiro: true,
      calendarId: calFinancas.id,
      rrule: JSON.stringify({ freq: "monthly" }),
      lembreteMin: 24 * 60,
    },
  });

  console.log("📅 6 agendas + eventos recorrentes");

  // ---------- Feriados (BrasilAPI com fallback estático) ----------
  const FERIADOS_2026 = [
    { date: "2026-01-01", name: "Confraternização Universal" },
    { date: "2026-02-17", name: "Carnaval" },
    { date: "2026-04-03", name: "Sexta-feira Santa" },
    { date: "2026-04-21", name: "Tiradentes" },
    { date: "2026-05-01", name: "Dia do Trabalho" },
    { date: "2026-06-04", name: "Corpus Christi" },
    { date: "2026-09-07", name: "Independência do Brasil" },
    { date: "2026-10-12", name: "Nossa Senhora Aparecida" },
    { date: "2026-11-02", name: "Finados" },
    { date: "2026-11-15", name: "Proclamação da República" },
    { date: "2026-11-20", name: "Dia da Consciência Negra" },
    { date: "2026-12-25", name: "Natal" },
  ];

  for (const ano of [2026, 2027]) {
    let feriados: { date: string; name: string }[] = [];
    try {
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) feriados = await res.json();
    } catch {
      // sem rede: usa fallback
    }
    if (feriados.length === 0 && ano === 2026) feriados = FERIADOS_2026;
    for (const f of feriados) {
      await db.holiday.upsert({
        where: { data_nome: { data: new Date(`${f.date}T00:00:00-03:00`), nome: f.name } },
        update: { ano },
        create: { data: new Date(`${f.date}T00:00:00-03:00`), nome: f.name, ano },
      });
    }
    console.log(`🇧🇷 ${feriados.length} feriados de ${ano}`);
  }

  // ---------- Metas do mês ----------
  await db.goal.createMany({
    data: [
      { titulo: "Aportar R$ 1.400 nos investimentos", mes: "2026-07", feito: true, ordem: 0 },
      { titulo: "Correr 40 km no mês", mes: "2026-07", feito: false, ordem: 1 },
      { titulo: "Ler 2 livros", mes: "2026-07", feito: true, ordem: 2 },
      { titulo: "Fechar julho abaixo de R$ 3.000", mes: "2026-07", feito: false, ordem: 3 },
    ],
  });

  // ---------- Metas configuráveis ----------
  await db.setting.createMany({
    data: [
      { key: "meta_agua_ml", value: "3000" },
      { key: "meta_treinos_mes", value: "16" },
      { key: "meta_treinos_semana", value: "4" },
      { key: "meta_km_mes", value: "40" },
      { key: "peso_alvo_kg", value: "78" },
      { key: "nome_usuario", value: "Lucas" },
    ],
  });

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
