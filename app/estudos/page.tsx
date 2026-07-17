"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Flag, Pause, Play, Square, Sparkles } from "lucide-react";
import { addStudySession, readStudySessions, type StudySessionRecord } from "@/lib/study-storage";

type TabKey = "timer" | "sessoes" | "dashboard";
type SessionStatus = "idle" | "running" | "paused" | "completed";

type StudySessionDraft = {
  subject: string;
  targetMinutes: number | null;
  sessionGoalLabel: string;
};

type StudyPause = {
  startedAt: number;
  endedAt: number | null;
  durationSec: number;
};

type StudyMark = {
  timestamp: number;
  label: string;
};

const SUBJECT_OPTIONS = ["Inglês", "Programação", "Leitura", "Matemática", "Projeto Caverna"];
const TARGET_OPTIONS = [
  { label: "Livre", minutes: null },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "1h30", minutes: 90 },
  { label: "2h", minutes: 120 },
];

export default function EstudosPage() {
  const [tab, setTab] = useState<TabKey>("timer");
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [draft, setDraft] = useState<StudySessionDraft>({
    subject: "Inglês",
    targetMinutes: null,
    sessionGoalLabel: "Sem meta",
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pauses, setPauses] = useState<StudyPause[]>([]);
  const [currentPause, setCurrentPause] = useState<StudyPause | null>(null);
  const [marks, setMarks] = useState<StudyMark[]>([]);
  const [markInput, setMarkInput] = useState("");
  const [showMarkInput, setShowMarkInput] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(4);

  useEffect(() => {
    setSessions(readStudySessions());
  }, []);

  useEffect(() => {
    document.title = status === "running" ? `⏱ ${formatClock(elapsedMs)} — Caverna` : "Estudos — Caverna";
  }, [elapsedMs, status]);

  useEffect(() => {
    if (status !== "running") return;

    const frame = window.setTimeout(() => setElapsedMs((value) => value + 1000), 1000);
    return () => window.clearTimeout(frame);
  }, [elapsedMs, status]);

  useEffect(() => {
    if (status !== "running") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const startSession = useCallback(() => {
    setStartedAt(Date.now());
    setElapsedMs(0);
    setPauses([]);
    setMarks([]);
    setCurrentPause(null);
    setStatus("running");
    setShowSummary(false);
  }, []);

  const handleToggle = useCallback(() => {
    if (status === "idle") {
      startSession();
      return;
    }
    if (status === "running") {
      setCurrentPause({ startedAt: Date.now(), endedAt: null, durationSec: 0 });
      setStatus("paused");
      return;
    }
    if (status === "paused") {
      if (currentPause) {
        const now = Date.now();
        const durationSec = Math.max(1, Math.floor((now - currentPause.startedAt) / 1000));
        setPauses((value) => [...value, { ...currentPause, endedAt: now, durationSec }]);
      }
      setCurrentPause(null);
      setStatus("running");
    }
  }, [currentPause, startSession, status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleToggle();
      }
      if (event.code === "Escape") {
        event.preventDefault();
        if (status === "running") {
          setShowSummary(true);
        }
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        setShowMarkInput(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggle, status]);

  const progress = useMemo(() => {
    if (!draft.targetMinutes) return 0;
    return Math.min(100, (elapsedMs / (draft.targetMinutes * 60 * 1000)) * 100);
  }, [draft.targetMinutes, elapsedMs]);

  const liquidSeconds = useMemo(() => {
    const totalPause = pauses.reduce((sum, pause) => sum + (pause.durationSec || 0), 0);
    return Math.max(0, Math.floor(elapsedMs / 1000) - totalPause);
  }, [elapsedMs, pauses]);

  const handleStop = () => {
    if (status === "running" || status === "paused") {
      setShowSummary(true);
    }
  };

  const saveSession = () => {
    const now = new Date();
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const pauseSeconds = pauses.reduce((sum, pause) => sum + pause.durationSec, 0);

    const session: StudySessionRecord = {
      id: `${now.getTime()}-${draft.subject}`,
      subject: draft.subject,
      startedAt: startedAt ? new Date(startedAt).toISOString() : now.toISOString(),
      endedAt: now.toISOString(),
      totalSeconds,
      netSeconds: Math.max(0, totalSeconds - pauseSeconds),
      targetMinutes: draft.targetMinutes,
      rating,
      notes: note.trim(),
      pauses: pauses.map((pause) => ({
        startedAt: new Date(pause.startedAt).toISOString(),
        endedAt: pause.endedAt ? new Date(pause.endedAt).toISOString() : null,
        durationSec: pause.durationSec,
      })),
      marks: marks.map((mark) => ({ timestamp: new Date(mark.timestamp).toISOString(), label: mark.label })),
      createdAt: now.toISOString(),
    };

    addStudySession(session);
    setSessions(readStudySessions());
    setStatus("idle");
    setStartedAt(null);
    setElapsedMs(0);
    setPauses([]);
    setMarks([]);
    setCurrentPause(null);
    setShowSummary(false);
    setNote("");
    setRating(4);
  };

  const addMark = () => {
    const label = markInput.trim();
    if (!label) return;
    setMarks((value) => [...value, { timestamp: Date.now(), label }]);
    setMarkInput("");
    setShowMarkInput(false);
  };

  const currentLabel = draft.subject || "Sem matéria";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-4 md:p-8">
      <section className="flex items-center justify-between rounded-full border border-[var(--color-stroke)]/70 bg-[rgba(9,13,22,0.7)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[var(--color-mint-soft)] p-2 text-[var(--color-mint)]">
            <BookOpen className="size-4" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-steel)]">Módulo extra</p>
            <h1 className="text-lg font-semibold text-[var(--color-paper)]">Relógio de estudo</h1>
          </div>
        </div>
        <div className="flex rounded-full border border-[var(--color-stroke)] bg-[var(--color-surface)] p-1">
          {(["timer", "sessoes", "dashboard"] as TabKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-4 py-2 text-sm capitalize transition ${tab === item ? "bg-[var(--color-mint)] text-[var(--color-bg)]" : "text-[var(--color-mist)]"}`}
            >
              {item === "timer" ? "Timer" : item === "sessoes" ? "Sessões" : "Dashboard"}
            </button>
          ))}
        </div>
      </section>

      {tab === "timer" ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-[var(--color-stroke)] bg-[rgba(9,13,22,0.92)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
            {status !== "idle" ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="relative flex size-[280px] items-center justify-center rounded-full border border-[var(--color-stroke)] md:size-[320px]">
                  <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90">
                    <circle cx="60" cy="60" r="54" stroke="var(--color-stroke)" strokeWidth="3" fill="none" />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      stroke="var(--color-mint)"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={339.292}
                      strokeDashoffset={339.292 * (1 - Math.min(1, progress / 100))}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="flex flex-col items-center text-center">
                    <div className={`text-5xl font-light tracking-[0.18em] tabular-nums md:text-6xl ${status === "paused" ? "text-[var(--color-amber)]" : "text-[var(--color-paper)]"}`}>
                      <span className="font-[Geist]">{formatClock(elapsedMs)}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--color-mist)]">{currentLabel}</p>
                    {status === "paused" ? <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-[var(--color-amber)]">Pausado</p> : null}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={handleStop} className="flex size-14 items-center justify-center rounded-full bg-[var(--color-coral-soft)] text-[var(--color-coral)]">
                    <Square className="size-6" />
                  </button>
                  <button type="button" onClick={handleToggle} className={`flex size-[64px] items-center justify-center rounded-full ${status === "running" ? "bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "bg-[var(--color-mint)] text-[var(--color-bg)]"}`}>
                    {status === "running" ? <Pause className="size-7" /> : <Play className="size-7" />}
                  </button>
                  <button type="button" onClick={() => setShowMarkInput((value) => !value)} className="flex size-14 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-mist)]">
                    <Flag className="size-6" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[12px] text-[var(--color-steel)]">
                  <span>Tempo líquido: {formatDuration(liquidSeconds)}</span>
                  <span>•</span>
                  <span>Pausas: {pauses.length} ({formatDuration(pauses.reduce((sum, item) => sum + item.durationSec, 0))})</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
                <div className="flex size-[280px] items-center justify-center rounded-full border border-dashed border-[var(--color-stroke)] bg-[var(--color-surface)]/70 md:size-[320px]">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-[var(--color-mist)]">Pronto para focar</p>
                    <h2 className="mt-3 text-3xl font-semibold text-[var(--color-paper)]">Escolha sua matéria e inicie.</h2>
                    <div className="mt-6 flex items-center justify-center text-[var(--color-mint)]">
                      <Sparkles className="size-5" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={startSession} className="rounded-full bg-[var(--color-mint)] px-5 py-3 text-sm font-medium text-[var(--color-bg)]">Iniciar sessão</button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/80 p-5">
              <h2 className="text-lg font-semibold text-[var(--color-paper)]">Configuração</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-sm text-[var(--color-mist)]">
                  Matéria/Tag
                  <input
                    value={draft.subject}
                    onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))}
                    list="subjects"
                    className="mt-2 w-full rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-paper)] outline-none"
                  />
                  <datalist id="subjects">
                    {SUBJECT_OPTIONS.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </label>

                <label className="block text-sm text-[var(--color-mist)]">
                  Meta de tempo
                  <select
                    value={draft.targetMinutes ?? "livre"}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "livre") {
                        setDraft((current) => ({ ...current, targetMinutes: null }));
                        return;
                      }
                      setDraft((current) => ({ ...current, targetMinutes: Number(value) }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-paper)] outline-none"
                  >
                    {TARGET_OPTIONS.map((option) => (
                      <option key={option.label} value={option.minutes ?? "livre"}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-[var(--color-mist)]">
                  Meta de sessões do dia
                  <input
                    value={draft.sessionGoalLabel}
                    onChange={(event) => setDraft((value) => ({ ...value, sessionGoalLabel: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-paper)] outline-none"
                  />
                </label>
              </div>
            </div>

            {(showMarkInput || marks.length > 0) && (
              <div className="rounded-[28px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/80 p-5">
                <h3 className="text-base font-semibold text-[var(--color-paper)]">Marcos</h3>
                {showMarkInput ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={markInput}
                      onChange={(event) => setMarkInput(event.target.value)}
                      placeholder="Ex.: terminei capítulo 3"
                      className="flex-1 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-paper)] outline-none"
                    />
                    <button type="button" onClick={addMark} className="rounded-2xl bg-[var(--color-mint)] px-3 py-2 text-sm font-medium text-[var(--color-bg)]">
                      Salvar
                    </button>
                  </div>
                ) : null}
                {marks.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-[var(--color-steel)]">
                    {marks.map((mark) => (
                      <li key={mark.timestamp} className="rounded-2xl border border-[var(--color-stroke)]/70 px-3 py-2">
                        {new Date(mark.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {mark.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : tab === "sessoes" ? (
        <section className="rounded-[32px] border border-[var(--color-stroke)] bg-[rgba(9,13,22,0.92)] p-6">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-[var(--color-stroke)] px-3 py-2 text-sm text-[var(--color-mist)]">Esta semana</div>
            <div className="rounded-full border border-[var(--color-stroke)] px-3 py-2 text-sm text-[var(--color-mist)]">Matéria: todas</div>
            <div className="rounded-full border border-[var(--color-stroke)] px-3 py-2 text-sm text-[var(--color-mist)]">Duração mínima: 30 min</div>
          </div>
          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-[24px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-paper)]">{session.subject}</p>
                    <p className="text-sm text-[var(--color-steel)]">{new Date(session.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                  <div className="text-sm text-[var(--color-mist)]">{Array.from({ length: session.rating ?? 0 }, () => "🔥").join("")}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--color-steel)]">
                  <span>Duração: {formatDuration(session.totalSeconds)}</span>
                  <span>Tempo líquido: {formatDuration(session.netSeconds)}</span>
                  <span>Pausas: {session.pauses.length}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[32px] border border-[var(--color-stroke)] bg-[rgba(9,13,22,0.92)] p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Tempo total", value: formatDuration(getTotalSeconds(sessions)) },
              { label: "Média diária", value: `${formatDuration(Math.round(getTotalSeconds(sessions) / Math.max(1, Math.min(7, sessions.length))))}/dia` },
              { label: "Sessões", value: `${sessions.length}` },
              { label: "Streak", value: `${getCurrentStreak(sessions)} dias` },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/70 p-4">
                <p className="text-sm text-[var(--color-mist)]">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--color-paper)]">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/70 p-5">
              <h3 className="text-lg font-semibold text-[var(--color-paper)]">Horas por dia da semana</h3>
              <div className="mt-6 flex items-end gap-3">
                {weekHours(sessions).map((item) => (
                  <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t-[16px] bg-[var(--color-mint)]/80" style={{ height: `${Math.max(12, item.value) * 20}px` }} />
                    <span className="text-sm text-[var(--color-steel)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--color-stroke)] bg-[var(--color-surface)]/70 p-5">
              <h3 className="text-lg font-semibold text-[var(--color-paper)]">Distribuição por matéria</h3>
              <div className="mt-6 space-y-3 text-sm text-[var(--color-steel)]">
                {subjectTotals(sessions).map((item) => (
                  <div key={item.subject} className="flex items-center justify-between rounded-2xl border border-[var(--color-stroke)]/70 px-3 py-2">
                    <span>{item.subject}</span>
                    <span>{formatDuration(item.seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {showSummary ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(0,0,0,0.6)] p-4">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--color-stroke)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--color-mist)]">Resumo da sessão</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--color-paper)]">Encerrar sessão?</h3>
              </div>
              <button type="button" onClick={() => setShowSummary(false)} className="text-sm text-[var(--color-steel)]">Fechar</button>
            </div>
            <div className="mt-6 space-y-4 text-sm text-[var(--color-steel)]">
              <div className="rounded-2xl border border-[var(--color-stroke)] p-4">
                <p className="text-[var(--color-mist)]">Matéria</p>
                <p className="mt-1 text-base text-[var(--color-paper)]">{draft.subject}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-stroke)] p-4">
                <p className="text-[var(--color-mist)]">Tempo</p>
                <p className="mt-1 text-base text-[var(--color-paper)]">{formatClock(elapsedMs)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-stroke)] p-4">
                <p className="text-[var(--color-mist)]">Pausas</p>
                <p className="mt-1 text-base text-[var(--color-paper)]">{pauses.length} registros • {formatDuration(pauses.reduce((sum, item) => sum + item.durationSec, 0))}</p>
              </div>
              <div className="rounded-2xl border border-[var(--color-stroke)] p-4">
                <p className="text-[var(--color-mist)]">Nota</p>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-paper)]" rows={3} />
              </div>
              <div className="rounded-2xl border border-[var(--color-stroke)] p-4">
                <p className="text-[var(--color-mist)]">Avaliação</p>
                <div className="mt-2 flex gap-2">
                  {Array.from({ length: 5 }, (_, value) => value + 1).map((value) => (
                    <button key={value} type="button" onClick={() => setRating(value)} className={`rounded-full px-3 py-2 text-sm ${rating === value ? "bg-[var(--color-mint)] text-[var(--color-bg)]" : "bg-[var(--color-surface-2)] text-[var(--color-mist)]"}`}>
                      {value}🔥
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowSummary(false)} className="flex-1 rounded-full border border-[var(--color-stroke)] px-4 py-3 text-sm text-[var(--color-paper)]">Continuar</button>
              <button type="button" onClick={saveSession} className="flex-1 rounded-full bg-[var(--color-mint)] px-4 py-3 text-sm font-medium text-[var(--color-bg)]">Salvar sessão</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

function getTotalSeconds(sessions: StudySessionRecord[]) {
  return sessions.reduce((sum, session) => sum + session.totalSeconds, 0);
}

function getCurrentStreak(sessions: StudySessionRecord[]) {
  const uniqueDays = Array.from(new Set(sessions.map((session) => new Date(session.startedAt).toISOString().slice(0, 10)))).sort();
  let streak = 0;
  const cursor = new Date();
  while (uniqueDays.includes(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function weekHours(sessions: StudySessionRecord[]) {
  return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label, index) => {
    const dayHours = sessions.reduce((sum, session) => {
      const sessionDay = new Date(session.startedAt).getDay();
      const normalizedDay = sessionDay === 0 ? 6 : sessionDay - 1;
      return normalizedDay === index ? sum + session.totalSeconds / 3600 : sum;
    }, 0);
    return { label, value: dayHours };
  });
}

function subjectTotals(sessions: StudySessionRecord[]) {
  const map = new Map<string, number>();
  sessions.forEach((session) => {
    map.set(session.subject, (map.get(session.subject) ?? 0) + session.totalSeconds);
  });
  return Array.from(map.entries()).map(([subject, seconds]) => ({ subject, seconds })).sort((a, b) => b.seconds - a.seconds);
}
