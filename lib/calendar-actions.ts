// lib/calendar-actions.ts
"use server";

/**
 * Return Google OAuth client ID and Calendar API key.
 * Both live on the server—never imported into client bundles.
 */
export async function getGoogleCalendarConfig() {
  return {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    apiKey:   process.env.GOOGLE_API_KEY             ?? "",
  };
}

/**
 * Fetch the Google Calendar REST API from the server side,
 * injecting your private API key in the URL.
 */
export async function makeServerSideCalendarRequest(
  endpoint: string,
  accessToken: string,
  options: { method?: string; body?: any } = {}
) {
  const apiKey = process.env.GOOGLE_API_KEY ?? "";
  if (!apiKey) throw new Error("API key not configured");

  const url = `https://www.googleapis.com/calendar/v3/${endpoint}?key=${apiKey}`;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API error ${res.status}: ${text}`);
  }
  return options.method === "DELETE" ? { success: true } : res.json();
}
