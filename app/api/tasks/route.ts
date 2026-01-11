// app/api/tasks/route.ts
import { NextResponse } from "next/server"
import { createTask } from "@/lib/task-service"

export async function POST(req: Request) {
  const task = await req.json()
  await createTask(task)
  return NextResponse.json({ success: true })
}
