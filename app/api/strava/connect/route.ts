import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  STRAVA_NEXT_COOKIE,
  STRAVA_STATE_COOKIE,
  STRAVA_STATE_COOKIE_OPTIONS,
  stravaAuthorizeUrl,
  stravaConfigurado,
} from "@/lib/strava";

// únicas páginas que podem receber o redirect de volta, evitando open-redirect.
// Natação fica de fora porque a aba não oferece conexão com o Strava.
const DESTINOS_PERMITIDOS = [
  "/treinos?tab=corrida",
  "/treinos?tab=ciclismo",
  "/configuracoes",
];

export async function GET(request: NextRequest) {
  await getCurrentUser();
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = DESTINOS_PERMITIDOS.includes(nextParam ?? "")
    ? nextParam!
    : "/treinos?tab=corrida";

  if (!stravaConfigurado()) {
    return NextResponse.redirect(
      new URL(
        `${next}${next.includes("?") ? "&" : "?"}erro=${encodeURIComponent("Strava não configurado. Preencha STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no .env.local.")}`,
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      )
    );
  }

  // state aleatório gravado em cookie httpOnly para o callback validar (anti-CSRF)
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(stravaAuthorizeUrl(state));
  res.cookies.set(STRAVA_STATE_COOKIE, state, {
    ...STRAVA_STATE_COOKIE_OPTIONS,
    maxAge: 600,
  });
  res.cookies.set(STRAVA_NEXT_COOKIE, next, {
    ...STRAVA_STATE_COOKIE_OPTIONS,
    maxAge: 600,
  });
  return res;
}
