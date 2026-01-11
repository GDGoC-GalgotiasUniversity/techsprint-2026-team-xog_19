import { type NextRequest, NextResponse } from "next/server"
import { getTasksStatistics } from "@/lib/task-service"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const user_id = searchParams.get("user_id")

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const stats = await getTasksStatistics(user_id)
    return NextResponse.json(stats)
  } catch (error: any) {
    console.error("Error in analytics API:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch analytics data" }, { status: 500 })
  }
}
