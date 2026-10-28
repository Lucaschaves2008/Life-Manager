import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_OPTIONS,
  handleOAuthCallback,
} from "@/lib/google-calendar/client";

export async function GET(request: NextRequest) {
  // getCurrentUser redireciona sem sessão e barra conta bloqueada.
  const user = await getCurrentUser();

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const erro = request.nextUrl.searchParams.get("error");
  const stateCookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  // NextResponse.redirect em vez de redirect(): o redirect() lança
  // NEXT_REDIRECT, e dentro de try/catch o sucesso caía no catch.
  const destino = (params: string) => {
    const res = NextResponse.redirect(new URL(`/configuracoes?${params}`, request.url));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { ...GOOGLE_STATE_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  if (erro) return destino(`google_error=${encodeURIComponent(erro)}`);
  if (!code) return destino("google_error=no_code");
  // segurança: o state deve bater com o cookie gerado no início do fluxo (anti-CSRF)
  if (!state || !stateCookie || state !== stateCookie) {
    return destino("google_error=state_invalido");
  }

  try {
    await handleOAuthCallback(code, user.id);
    return destino("google_connected=true");
  } catch (error) {
    console.error("[Google Calendar] Erro no callback:", error);
    return destino("google_error=callback_failed");
  }
}
