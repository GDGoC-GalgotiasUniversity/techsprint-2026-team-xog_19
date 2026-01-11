// app/api/google‑calendar/route.ts
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    console.log("📥 received in API:", json);

    const { endpoint, accessToken, method, body } = json;
    if (!endpoint || !accessToken) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // build URL without any ?key=…
    const url = endpoint.startsWith("http")
      ? endpoint
      : `https://www.googleapis.com/calendar/v3/${endpoint}`;

    // 🔥 debug: print the URL we’re about to fetch
    console.log("🌐 fetching Google Calendar URL:", url);

    const response = await fetch(url, {
      method: method || "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Calendar API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    if (method === "DELETE") {
      return NextResponse.json({ success: true });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Server-side calendar request failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
