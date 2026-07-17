export type StudySeedSession = {
  subject: string;
  startedAt: string;
  endedAt: string;
  totalSeconds: number;
  netSeconds: number;
  targetMinutes: number | null;
  rating: number;
  notes?: string;
  pauses: Array<{ startedAt: string; endedAt: string; durationSec: number }>;
  marks: Array<{ timestamp: string; label: string }>;
};

export const studySeedSessions: StudySeedSession[] = [
  {
    subject: "Inglês",
    startedAt: "2026-07-13T14:00:00.000Z",
    endedAt: "2026-07-13T14:48:00.000Z",
    totalSeconds: 2880,
    netSeconds: 2640,
    targetMinutes: 45,
    rating: 4,
    notes: "Foco em leitura e vocabulário.",
    pauses: [{ startedAt: "2026-07-13T14:20:00.000Z", endedAt: "2026-07-13T14:24:00.000Z", durationSec: 240 }],
    marks: [{ timestamp: "2026-07-13T14:25:00.000Z", label: "Terminei o capítulo 3" }],
  },
  {
    subject: "Programação",
    startedAt: "2026-07-14T20:30:00.000Z",
    endedAt: "2026-07-14T22:00:00.000Z",
    totalSeconds: 5400,
    netSeconds: 4680,
    targetMinutes: 90,
    rating: 5,
    notes: "Implementação da tela do timer.",
    pauses: [
      { startedAt: "2026-07-14T21:05:00.000Z", endedAt: "2026-07-14T21:12:00.000Z", durationSec: 420 },
      { startedAt: "2026-07-14T21:35:00.000Z", endedAt: "2026-07-14T21:40:00.000Z", durationSec: 300 },
    ],
    marks: [{ timestamp: "2026-07-14T21:46:00.000Z", label: "Módulo pronto" }],
  },
  {
    subject: "Leitura",
    startedAt: "2026-07-15T08:30:00.000Z",
    endedAt: "2026-07-15T09:00:00.000Z",
    totalSeconds: 1800,
    netSeconds: 1620,
    targetMinutes: 30,
    rating: 3,
    pauses: [{ startedAt: "2026-07-15T08:46:00.000Z", endedAt: "2026-07-15T08:52:00.000Z", durationSec: 360 }],
    marks: [],
  },
  {
    subject: "Matemática",
    startedAt: "2026-07-16T19:00:00.000Z",
    endedAt: "2026-07-16T20:00:00.000Z",
    totalSeconds: 3600,
    netSeconds: 3300,
    targetMinutes: 60,
    rating: 4,
    notes: "Exercícios de álgebra.",
    pauses: [{ startedAt: "2026-07-16T19:30:00.000Z", endedAt: "2026-07-16T19:37:00.000Z", durationSec: 420 }],
    marks: [],
  },
  {
    subject: "Projeto Caverna",
    startedAt: "2026-07-16T21:00:00.000Z",
    endedAt: "2026-07-16T23:00:00.000Z",
    totalSeconds: 7200,
    netSeconds: 6480,
    targetMinutes: 120,
    rating: 5,
    notes: "Refinamento do módulo de estudos.",
    pauses: [{ startedAt: "2026-07-16T22:00:00.000Z", endedAt: "2026-07-16T22:10:00.000Z", durationSec: 600 }],
    marks: [{ timestamp: "2026-07-16T22:30:00.000Z", label: "Versão inicial entregue" }],
  },
];
