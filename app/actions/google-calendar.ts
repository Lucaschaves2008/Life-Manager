"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthUrl,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_OPTIONS,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar/client";

export async function getGoogleAuthUrl(): Promise<string> {
  await requireUser();
  if (!isGoogleCalendarConfigured()) {
    throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  }
  // state aleatório gravado em cookie httpOnly para o callback validar (anti-CSRF)
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE, state, { ...GOOGLE_STATE_COOKIE_OPTIONS, maxAge: 600 });
  return getAuthUrl(state);
}

export async function isGoogleCalendarAvailable(): Promise<boolean> {
  await requireUser();
  return isGoogleCalendarConfigured();
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const user = await requireUser();
  await db.googleIntegration.deleteMany({
    where: { userId: user.id },
  });

  // Remover marcação de sincronização dos calendários
  await db.calendar.updateMany({
    where: { userId: user.id, googleId: { not: null } },
    data: { googleId: null, sincronizado: false },
  });
}

export async function getGoogleIntegrationStatus(): Promise<{
  connected: boolean;
  email?: string;
}> {
  const user = await requireUser();
  const integration = await db.googleIntegration.findUnique({
    where: { userId: user.id },
  });

  return {
    connected: !!integration,
  };
}
