"use client";

export type StudyPauseRecord = {
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
};

export type StudyMarkRecord = {
  timestamp: string;
  label: string;
};

export type StudySessionRecord = {
  id: string;
  subject: string;
  startedAt: string;
  endedAt: string;
  totalSeconds: number;
  netSeconds: number;
  targetMinutes: number | null;
  rating: number;
  notes: string;
  pauses: StudyPauseRecord[];
  marks: StudyMarkRecord[];
  createdAt: string;
};

const STORAGE_KEY = "caverna.studySessions";

export function readStudySessions(): StudySessionRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSeedStudySessions();

    const parsed = JSON.parse(raw) as StudySessionRecord[];
    return Array.isArray(parsed) ? parsed : getSeedStudySessions();
  } catch {
    return getSeedStudySessions();
  }
}

export function addStudySession(session: StudySessionRecord): StudySessionRecord[] {
  const sessions = [...readStudySessions(), session];
  persistStudySessions(sessions);
  return sessions;
}

export function updateStudySession(id: string, updates: Partial<StudySessionRecord>) {
  const sessions = readStudySessions().map((session) =>
    session.id === id ? { ...session, ...updates } : session
  );
  persistStudySessions(sessions);
  return sessions;
}

export function deleteStudySession(id: string) {
  const sessions = readStudySessions().filter((session) => session.id !== id);
  persistStudySessions(sessions);
  return sessions;
}

export function getSeedStudySessions(): StudySessionRecord[] {
  const now = new Date();
  const seed = [
    {
      id: "seed-english",
      subject: "Inglês",
      startedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      endedAt: new Date(now.getTime() - 1000 * 60 * 60 * 1).toISOString(),
      totalSeconds: 3600,
      netSeconds: 3300,
      targetMinutes: 60,
      rating: 4,
      notes: "Sessão leve e consistente com foco em listening.",
      pauses: [{ startedAt: now.toISOString(), endedAt: null, durationSec: 0 }],
      marks: [{ timestamp: now.toISOString(), label: "Pratiquei 20 min de podcast" }],
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 1.5).toISOString(),
    },
    {
      id: "seed-programming",
      subject: "Programação",
      startedAt: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
      endedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
      totalSeconds: 7200,
      netSeconds: 6600,
      targetMinutes: 120,
      rating: 5,
      notes: "Consegui avançar no módulo de estudos e fechar a tarefa principal.",
      pauses: [{ startedAt: now.toISOString(), endedAt: null, durationSec: 0 }],
      marks: [{ timestamp: now.toISOString(), label: "Feature do timer pronta" }],
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 7).toISOString(),
    },
  ];
  persistStudySessions(seed);
  return seed;
}

function persistStudySessions(sessions: StudySessionRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
