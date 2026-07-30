import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { handleOAuthCallback } from "@/lib/google-calendar/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Erro do Google
  if (error) {
    return redirect(`/configuracoes?google_error=${error}`);
  }

  if (!code) {
    return redirect("/configuracoes?google_error=no_code");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return redirect("/login");
    }

    await handleOAuthCallback(code, user.id);
    return redirect("/configuracoes?google_connected=true");
  } catch (error) {
    console.error("[Google Calendar] Erro no callback:", error);
    return redirect("/configuracoes?google_error=callback_failed");
  }
}
