// app/api/google-calendar-config/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // read only server‑side envs (non‐NEXT_PUBLIC)
    const apiKey   = process.env.GOOGLE_API_KEY   ?? "";
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";

    // don’t throw—just return whatever you have
    return NextResponse.json({ apiKey, clientId });
  } catch (err: any) {
    // catch _any_ unexpected error and return JSON
    console.error("Route error:", err);
    return NextResponse.json(
      { apiKey: "", clientId: "", error: err.message },
      { status: 500 }
    );
  }
}
