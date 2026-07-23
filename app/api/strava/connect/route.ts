import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  STRAVA_STATE_COOKIE,
  STRAVA_STATE_COOKIE_OPTIONS,
  stravaAuthorizeUrl,
  stravaConfigurado,
} from "@/lib/strava";

export async function GET() {
  await getCurrentUser();

  if (!stravaConfigurado()) {
    return NextResponse.redirect(
      new URL(
        `/treinos?tab=corrida&erro=${encodeURIComponent("Strava não configurado. Preencha STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET no .env.local.")}`,
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
  return res;
}
