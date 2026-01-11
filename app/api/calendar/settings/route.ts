// app/api/calendar/settings/route.ts
import { NextResponse } from "next/server"
import { getFirestore, doc, getDoc } from "firebase/firestore"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const user_id = url.searchParams.get("user_id")
  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
  }
  const db = getFirestore()
  const ref = doc(db, "users", user_id, "settings", "calendar")
  const snap = await getDoc(ref)
  return snap.exists()
    ? NextResponse.json(snap.data())
    : NextResponse.json({ enabled: false })
}
