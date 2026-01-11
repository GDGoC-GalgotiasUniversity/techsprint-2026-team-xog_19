"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import DashboardHeader from "@/components/dashboard-header"
import { Card } from "@/components/ui/card"
import ChatInterface from "@/components/ai-chat/chat-interface"
import { getTasksStatistics } from "@/lib/task-service"

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    categoryBreakdown: {},
    priorityBreakdown: { high: 0, medium: 0, low: 0 },
  })

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authLoading && !user) {
      router.push("/login")
      return
    }

    // Fetch stats directly from the task service
    const fetchStats = async () => {
      try {
        setLoading(true)

        if (!user) {
          throw new Error("User not authenticated")
        }

        // Use the task service directly instead of an API route
        const taskStats = await getTasksStatistics(user.uid)
        setStats(taskStats)
        setLoading(false)
      } catch (error: any) {
        console.error("Error fetching task statistics:", error)
        setError(error.message || "Failed to fetch task statistics.")
        setLoading(false)
      }
    }

    if (user) {
      fetchStats()
    }
  }, [user, authLoading, router])

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  const mostActiveCategory = Object.entries(stats.categoryBreakdown || {}).reduce(
    (acc, [category, count]) =>
      count > (stats.categoryBreakdown[acc as keyof typeof stats.categoryBreakdown] || 0) ? category : acc,
    "",
  )

  const mostActiveCategoryFormatted =
    mostActiveCategory.length > 0 ? mostActiveCategory.charAt(0).toUpperCase() + mostActiveCategory.slice(1) : "-"

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader />
        <div className="flex flex-1 justify-center items-center">
          <div className="text-muted-foreground">Loading analytics data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <DashboardHeader />
        <div className="flex flex-1 justify-center items-center">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-primary">Productivity Analytics</h1>
          <p className="mt-2 text-muted-foreground">Track your task completion trends and patterns</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Total Tasks</h2>
            <p className="text-3xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Completion Rate</h2>
            <p className="text-3xl font-bold">{completionRate}%</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Overdue Tasks</h2>
            <p className="text-3xl font-bold">{stats.overdue}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Most Active Category</h2>
            <p className="text-3xl font-bold">{mostActiveCategoryFormatted}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">High Priority Tasks</h2>
            <p className="text-3xl font-bold">{stats.priorityBreakdown.high ?? 0}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Medium Priority Tasks</h2>
            <p className="text-3xl font-bold">{stats.priorityBreakdown.medium ?? 0}</p>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Low Priority Tasks</h2>
            <p className="text-3xl font-bold">{stats.priorityBreakdown.low ?? 0}</p>
          </Card>
        </div>
      </main>
      <ChatInterface />
    </div>
  )
}
