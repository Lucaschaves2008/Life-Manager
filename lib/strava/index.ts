import "server-only";
import { db } from "@/lib/db";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API = "https://www.strava.com/api/v3";

/** Cookie httpOnly que carrega o state anti-CSRF entre connect e callback. */
export const STRAVA_STATE_COOKIE = "strava_oauth_state";
export const STRAVA_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  // secure em produção; em dev (http://localhost) o Safari rejeita cookies Secure.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/strava",
} as const;

export function stravaConfigurado(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export function stravaAuthorizeUrl(state: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number };
};

/** Troca o code do OAuth por tokens e persiste em StravaAccount. */
export async function trocarCodePorTokens(userId: string, code: string) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange falhou: ${res.status}`);
  const data = (await res.json()) as TokenResponse;

  await db.stravaAccount.upsert({
    where: { userId },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
      athleteId: data.athlete?.id ? String(data.athlete.id) : null,
    },
    create: {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
      athleteId: data.athlete?.id ? String(data.athlete.id) : null,
    },
  });
}

/** Devolve um access token válido, renovando via refresh se estiver expirado. */
async function accessTokenValido(userId: string): Promise<string | null> {
  const conta = await db.stravaAccount.findUnique({ where: { userId } });
  if (!conta) return null;

  // 60s de folga antes de expirar
  if (conta.expiresAt.getTime() - 60_000 > Date.now()) return conta.accessToken;

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      refresh_token: conta.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava refresh falhou: ${res.status}`);
  const data = (await res.json()) as TokenResponse;

  await db.stravaAccount.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
    },
  });
  return data.access_token;
}

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number; // metros
  moving_time: number; // segundos
  start_date_local: string;
};

/**
 * Busca atividades de corrida recentes e cria registros Run que ainda não existem
 * (dedup por stravaActivityId). Retorna quantas foram importadas.
 */
export async function sincronizarCorridas(userId: string): Promise<number> {
  const token = await accessTokenValido(userId);
  if (!token) throw new Error("Conta Strava não conectada.");

  const res = await fetch(`${STRAVA_API}/athlete/activities?per_page=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Strava activities falhou: ${res.status}`);
  const atividades = (await res.json()) as StravaActivity[];

  const corridas = atividades.filter(
    (a) => a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun"
  );

  let importadas = 0;
  for (const a of corridas) {
    const jaExiste = await db.run.findFirst({
      where: { userId, stravaActivityId: String(a.id) },
    });
    if (jaExiste) continue;

    await db.run.create({
      data: {
        userId,
        data: new Date(a.start_date_local),
        km: Math.round((a.distance / 1000) * 100) / 100,
        segundos: a.moving_time,
        tipo: "Moderado",
        sensacao: 3,
        notas: a.name,
        stravaActivityId: String(a.id),
        stravaLink: `https://www.strava.com/activities/${a.id}`,
      },
    });
    importadas++;
  }
  return importadas;
}

export async function stravaConectado(userId: string): Promise<boolean> {
  const conta = await db.stravaAccount.findUnique({ where: { userId } });
  return Boolean(conta);
}
