import "server-only";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error(
    "Google OAuth env vars não configuradas: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
  );
}

export function getOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });
}

export async function getCalendarClient(userId: string) {
  const integration = await db.googleIntegration.findUnique({
    where: { userId },
  });

  if (!integration) {
    throw new Error("Google Calendar não está conectado.");
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.expiresAt?.getTime(),
  });

  // Atualizar token se expirou
  if (
    integration.expiresAt &&
    new Date() > integration.expiresAt
  ) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await db.googleIntegration.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token || "",
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      },
    });
    oauth2Client.setCredentials(credentials);
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function handleOAuthCallback(
  code: string,
  userId: string
): Promise<void> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  await db.googleIntegration.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    },
    update: {
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    },
  });
}
