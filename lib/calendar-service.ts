// lib/calendar-service.ts
/**
 * Load the Google Identity Services script onto window.google
 */
export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    // running on server—nothing to load
    return Promise.resolve()
  }
  if (window.google) {
    // already loaded
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    if (document.getElementById("gis")) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.id = "gis"
    script.src = "https://accounts.google.com/gsi/client"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load GIS"))
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    google?: any
  }
}

const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"

let accessToken: string | null = null
let expiry: number | null = null

export function isTokenValid() {
  return !!accessToken && !!expiry && Date.now() < expiry! - 5 * 60 * 1000
}

export function isGoogleAuthenticated(): boolean {
  // Alias for token validity check
  return isTokenValid()
}

export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.host;
  return !host.startsWith("aitasksmanager"); // only treat subdomains as preview
}


export async function initializeGoogleCalendarOnLoad(): Promise<void> {
  if (!window.google) {
    await loadGoogleIdentityScript()
  }
}

/**
 * Check if Google API is available
 */
export function isGoogleApiAvailable(): boolean {
  return typeof window !== "undefined" && !!window.google
}

/**
 * Request or reuse an access token
 */
export async function signInToGoogle(): Promise<string> {
  if (isTokenValid()) return accessToken!

  await initializeGoogleCalendarOnLoad()

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable")
  }

  return new Promise((res, rej) => {
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (r: any) => {
          if (r.error) return rej(r.error)
          accessToken = r.access_token
          expiry = Date.now() + r.expires_in * 1000
          res(accessToken!)
        },
      })
      .requestAccessToken()
  })
}

// alias for existing imports
export const getAccessToken = signInToGoogle

/**
 * Create a new event in the user's calendar.
 */
export async function createCalendarEvent(event: {
  calendarId: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
}): Promise<string> {
  const token = await signInToGoogle()
  const { calendarId, ...body } = event

  const res = await fetch("/api/google-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: `calendars/${calendarId}/events`,
      accessToken: token,
      method: "POST",
      body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Create event failed: ${err}`)
  }
  const data = await res.json()
  return data.id
}

/**
 * Update an existing event in the user's calendar.
 */
export async function updateCalendarEvent(event: {
  calendarId: string
  eventId: string
  summary?: string
  description?: string
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
}): Promise<boolean> {
  const token = await signInToGoogle()
  const { calendarId, eventId, ...body } = event

  const res = await fetch("/api/google-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: `calendars/${calendarId}/events/${eventId}`,
      accessToken: token,
      method: "PUT",
      body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Update event failed: ${err}`)
  }
  return true
}

/**
 * Delete an event from the user's calendar.
 */
export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const token = await signInToGoogle()

  const res = await fetch("/api/google-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: `calendars/${calendarId}/events/${eventId}`,
      accessToken: token,
      method: "DELETE",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Delete event failed: ${err}`)
  }
}

/**
 * Get calendar integration settings for a user.
 */
export async function getCalendarSettings(user_id: string) {
  const res = await fetch(`/api/calendar/settings?user_id=${user_id}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get calendar settings: ${err}`)
  }
  return res.json()
}

/**
 * Save calendar settings for a user.
 */
export async function saveCalendarSettings(user_id: string, settings: any) {
  const res = await fetch(`/api/calendar/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, settings }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to save calendar settings: ${err}`)
  }
}
