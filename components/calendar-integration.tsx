"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
// ← we’ll now actually use this to fetch an OAuth token
import { getAccessToken, initializeGoogleCalendarOnLoad } from "@/lib/calendar-service";
export default function CalendarIntegration() {
  console.log("[Calendar] 🚀 CalendarIntegration mounted");
  useEffect(() => {
    initializeGoogleCalendarOnLoad()
      .then(() => console.log("[Calendar] GIS script loaded"))
      .catch(err => console.error("[Calendar] GIS load failed", err));
  }, []);
  const { toast } = useToast();
  const { user } = useAuth();

  const [calendars, setCalendars] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    console.log("[Calendar] 🔥 handleConnect started");
    if (!user) {
      console.log("[Calendar] No user");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1️⃣ get a real OAuth access token
      console.log("[Calendar] Calling getAccessToken()");
      const token = await getAccessToken();
      console.log("[Calendar] Received token:", token);

      // 2️⃣ call your proxy with both endpoint & accessToken
      console.log("[Calendar] Fetching /api/google-calendar");
      const res = await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // you can keep the full URL here if you like—
          // our updated route.ts will handle it
          endpoint: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          accessToken: token,
          method: "GET",
        }),
      });

      console.log("[Calendar] Fetch response:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error("[Calendar] Fetch error body:", text);
        throw new Error(text);
      }

      const data = await res.json();
      console.log("[Calendar] Calendars data:", data);
      setCalendars(data.items || []); // Google returns { items: […] }
      toast({ title: "Connected!", description: "Calendars loaded." });
    } catch (e: any) {
      console.error("[Calendar] Error in handleConnect:", e);
      setError(e.error || e.message || "Unknown error");
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Integration</CardTitle>
        <CardDescription>Connect your Google Calendar to sync tasks</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && <div className="text-red-600">Error: {error}</div>}

        {calendars === null ? (
          <Button onClick={handleConnect} className="w-full" disabled={loading}>
            {loading ? "Connecting…" : "Connect Calendar"}
          </Button>
        ) : calendars.length === 0 ? (
          <div>No calendars found</div>
        ) : (
          <ul className="space-y-2">
            {calendars.map((cal) => (
              <li key={cal.id} className="p-2 border rounded">
                {cal.summary}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          onClick={() => {
            setCalendars(null);
            setError(null);
          }}
        >
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
