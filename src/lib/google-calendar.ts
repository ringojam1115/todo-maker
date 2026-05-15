export type CalendarSlots = Record<string, number>; // date (YYYY-MM-DD) → available minutes

const STUDY_START_HOUR = 7; // 7:00
const STUDY_END_HOUR = 23; // 23:00
const STUDY_DAY_MINUTES = (STUDY_END_HOUR - STUDY_START_HOUR) * 60; // 960 min

export function requestGoogleCalendarToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID が設定されていません"));
      return;
    }

    const g = (window as Window & { google?: typeof google }).google;
    if (!g?.accounts?.oauth2) {
      reject(new Error("Google Identity Services が読み込まれていません"));
      return;
    }

    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? "OAuth失敗"));
        } else {
          resolve(response.access_token);
        }
      },
      error_callback: (err) => {
        reject(new Error(err.type));
      },
    });

    client.requestAccessToken();
  });
}

interface CalendarEvent {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
}

export async function getCalendarFreeSlots(
  accessToken: string,
  daysAhead = 60
): Promise<CalendarSlots> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message ?? `Calendar API error ${res.status}`);
  }

  const data = await res.json();

  // Initialize all days with full study hours
  const slots: CalendarSlots = {};
  const d = new Date(now);
  while (d < end) {
    slots[d.toISOString().split("T")[0]] = STUDY_DAY_MINUTES;
    d.setDate(d.getDate() + 1);
  }

  // Subtract busy time from each day
  for (const event of (data.items ?? []) as CalendarEvent[]) {
    if (event.status === "cancelled") continue;
    if (!event.start?.dateTime || !event.end?.dateTime) continue; // skip all-day

    const startDt = new Date(event.start.dateTime);
    const endDt = new Date(event.end.dateTime);
    const dateStr = startDt.toISOString().split("T")[0];

    if (slots[dateStr] === undefined) continue;

    // Clamp to study hours
    const startMin = startDt.getHours() * 60 + startDt.getMinutes();
    const endMin = endDt.getHours() * 60 + endDt.getMinutes();
    const effectiveStart = Math.max(startMin, STUDY_START_HOUR * 60);
    const effectiveEnd = Math.min(endMin, STUDY_END_HOUR * 60);
    const busy = Math.max(0, effectiveEnd - effectiveStart);

    slots[dateStr] = Math.max(0, slots[dateStr] - busy);
  }

  return slots;
}
