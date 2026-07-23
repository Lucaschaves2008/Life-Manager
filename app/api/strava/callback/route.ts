import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  STRAVA_STATE_COOKIE,
  STRAVA_STATE_COOKIE_OPTIONS,
  trocarCodePorTokens,
} from "@/lib/strava";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const erro = request.nextUrl.searchParams.get("error");
  const stateCookie = request.cookies.get(STRAVA_STATE_COOKIE)?.value;

  const destino = (msg?: string, ok = false) => {
    const res = NextResponse.redirect(
      new URL(
        `/treinos?tab=corrida${ok ? "&strava=ok" : msg ? `&erro=${encodeURIComponent(msg)}` : ""}`,
        appUrl
      )
    );
    // apaga o cookie de state após o uso
    res.cookies.set(STRAVA_STATE_COOKIE, "", {
      ...STRAVA_STATE_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return res;
  };

  if (erro) return destino("Autorização do Strava cancelada.");
  if (!code) return destino("Código de autorização ausente.");
  // segurança: o state deve bater com o cookie gerado no connect (anti-CSRF)
  if (!state || !stateCookie || state !== stateCookie)
    return destino("Falha na verificação do Strava.");

  try {
    await trocarCodePorTokens(user.id, code);
    return destino(undefined, true);
  } catch {
    return destino("Não foi possível conectar ao Strava. Tente novamente.");
  }
}
