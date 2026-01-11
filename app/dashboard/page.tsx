"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  PlusCircle,
  Calendar,
  BarChart2,
  Clock,
  AlertCircle,
} from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"
import TaskList from "@/components/task-list"
import ChatInterface from "@/components/ai-chat/chat-interface"
import type { Task } from "@/types/task"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { getUserTasks } from "@/lib/task-service"
import { processDueNotifications } from "@/lib/notification-service"

export default function DashboardPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")

  // Listen for auth state
  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
      } else {
        router.replace("/login")
      }
      setAuthChecked(true)
    })
    return () => unsub()
  }, [router])

  // Fetch tasks with real UID
  const fetchTasks = async (u: User) => {
    setLoading(true)
    setError(null)
    setPermissionError(false)

    try {
      const tasksList = await getUserTasks(u.uid)
      setTasks(tasksList)
    } catch (err: any) {
      console.error("Error fetching tasks:", err)
      const msg = err.message || ""
      if (msg.includes("permission") || msg.includes("insufficient")) {
        setPermissionError(true)
        setError("You don't have permission to read tasks.")
      } else {
        setError(msg || "Failed to fetch tasks")
      }
    } finally {
      setLoading(false)
    }
  }

  // Once auth is checked, load tasks & notifications
  useEffect(() => {
    if (authChecked && user) {
      fetchTasks(user)
      processDueNotifications(user.uid).catch(console.error)
    }
  }, [authChecked, user])

  // Periodic notification polling
  useEffect(() => {
    if (!user) return

    processDueNotifications(user.uid).catch(console.error)
    const intervalId = setInterval(() => {
      processDueNotifications(user.uid).catch(console.error)
    }, 60_000)

    return () => clearInterval(intervalId)
  }, [user])

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground">Checking authentication…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const pendingCount = tasks.filter((t) => t.status === "pending").length
  const completedCount = tasks.filter((t) => t.status === "completed")
    .length
  const totalCount = tasks.length
  const completionRate = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const upcomingTasks = tasks
    .filter(
      (t) =>
        t.status === "pending" &&
        t.scheduledTime &&
        new Date(t.scheduledTime) >= today &&
        new Date(t.scheduledTime) < tomorrow
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledTime!).getTime() -
        new Date(b.scheduledTime!).getTime()
    )

  const overdueTasks = tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.deadline &&
      new Date(t.deadline).getTime() < Date.now()
  )

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Welcome back
          {user.displayName ? `, ${user.displayName}` : ""}!
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Your task overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded bg-secondary text-center">
                  <div className="text-sm">Pending</div>
                  <div className="text-2xl font-bold">{pendingCount}</div>
                </div>
                <div className="p-3 border rounded bg-secondary text-center">
                  <div className="text-sm">Completed</div>
                  <div className="text-2xl font-bold">{completedCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Completion Rate</CardTitle>
              <CardDescription>Your progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="relative h-24 w-24">
                  <svg viewBox="0 0 100 100" className="h-full w-full">
                    <circle
                      r="40"
                      cx="50"
                      cy="50"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="none"
                      className="text-secondary"
                    />
                    <circle
                      r="40"
                      cx="50"
                      cy="50"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={`${
                        (completionRate / 100) * 2 * Math.PI * 40
                      } ${2 * Math.PI * 40}`}
                      strokeLinecap="round"
                      fill="none"
                      className="text-primary"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {completionRate}%
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {completedCount} of {totalCount} tasks
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start"
                onClick={() => router.push("/tasks/new")}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                New Task
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push("/schedule")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push("/analytics")}
              >
                <BarChart2 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule & Overdue */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Tasks for today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-8 w-8" />
                </div>
              ) : upcomingTasks.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center">
                  <Clock className="h-8 w-8 mb-2 text-muted-foreground" />
                  <div>No tasks scheduled</div>
                </div>
              ) : (
                upcomingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center p-3 border rounded bg-secondary mb-2"
                  >
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {t.scheduledTime &&
                          new Date(t.scheduledTime).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`h-3 w-3 rounded-full mr-2 ${
                          t.priority === "high"
                            ? "bg-red-500"
                            : t.priority === "medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                      />
                      <span className="text-sm">{t.duration}m</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overdue</CardTitle>
              <CardDescription>Past deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-8 w-8" />
                </div>
              ) : overdueTasks.length === 0 ? (
                <div className="h-32 flex items-center justify-center">
                  No overdue tasks
                </div>
              ) : (
                overdueTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center p-3 border rounded bg-secondary mb-2"
                  >
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-sm text-muted-foreground">
                        Due{" "}
                        {t.deadline &&
                          new Date(t.deadline).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-sm text-red-500">Overdue</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full Task List */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Your Tasks</CardTitle>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              defaultValue="all"
            >
              <TabsList>
                {["all", "pending", "completed", "work", "personal"].map(
                  (v) => (
                    <TabsTrigger key={v} value={v}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </TabsTrigger>
                  )
                )}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={tasks.filter((t) =>
                activeTab === "all"
                  ? true
                  : t.status === activeTab || t.category === activeTab
              )}
              loading={loading}
              permissionError={permissionError}
              onTaskUpdate={() => user && fetchTasks(user)}
            />
          </CardContent>
        </Card>
      </main>
      <ChatInterface />
    </div>
  )
}
