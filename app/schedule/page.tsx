"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged, type User } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, RefreshCw, ShieldAlert, AlertTriangle, ExternalLink, AlertCircle, Info } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import DashboardHeader from "@/components/dashboard-header"
import { scheduleTasksOptimally } from "@/lib/scheduler"
import type { Task } from "@/types"
import { Badge } from "@/components/ui/badge"
import ChatInterface from "@/components/ai-chat/chat-interface"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { createTaskReminders } from "@/lib/notification-service"
import { getUserTasks, updateTask, getTasksForPeriod } from "@/lib/task-service"
import {
  initializeGoogleCalendarOnLoad,
  createCalendarEvent,
  isGoogleAuthenticated,
  signInToGoogle,
  isPreviewEnvironment,
} from "@/lib/calendar-service"

export default function SchedulePage() {
  // Router and toast
  const router = useRouter()
  const { toast } = useToast()

  // Authentication state
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isScheduling, setIsScheduling] = useState(false)
  const [view, setView] = useState<"day" | "week" | "month">("day")

  // Error states
  const [permissionError, setPermissionError] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [notificationPermissionError, setNotificationPermissionError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar state
  const [calendarInitialized, setCalendarInitialized] = useState(false)
  const [calendarAuthenticated, setCalendarAuthenticated] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false)

  // Authentication effect
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthChecked(true)
      if (!currentUser) {
        router.replace("/login")
      }
    })
    return () => unsubscribe()
  }, [router])

  // Check if we're in a preview environment
  useEffect(() => {
    setIsPreview(isPreviewEnvironment())
  }, [])

  // Calendar initialization effect
  useEffect(() => {
    const initCalendar = async () => {
      if (!user) return

      try {
        setCalendarError(null)
        const initialized = await initializeGoogleCalendarOnLoad()
        setCalendarInitialized(initialized)

        if (initialized) {
          const authenticated = isGoogleAuthenticated()
          setCalendarAuthenticated(authenticated)
        }
      } catch (error: any) {
        console.error("Failed to initialize Google Calendar:", error)
        setCalendarError(error.message || "Failed to initialize Google Calendar")
      }
    }

    if (user) {
      initCalendar()
    }
  }, [user])

  // Fetch tasks function
  const fetchTasks = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      setPermissionError(false)
      setIndexError(null)
      setError(null)

      // Calculate date range based on view
      const now = new Date()
      const startDate = new Date(now)
      let endDate = new Date(now)

      if (view === "day") {
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
      } else if (view === "week") {
        // Start from Sunday of current week
        const day = now.getDay() // 0 = Sunday, 1 = Monday, etc.
        startDate.setDate(now.getDate() - day)
        startDate.setHours(0, 0, 0, 0)

        // End on Saturday of current week
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
      } else if (view === "month") {
        // Start from first day of current month
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)

        // End on last day of current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        endDate.setHours(23, 59, 59, 999)
      }

      try {
        // Get tasks for the selected period
        const periodTasks = await getTasksForPeriod(user.uid, startDate, endDate)

        // Get all pending tasks without a schedule (for scheduling)
        const allTasks = await getUserTasks(user.uid)
        const unscheduledTasks = allTasks.filter((task) => task.status === "pending" && !task.scheduledTime)

        // Combine scheduled and unscheduled tasks
        setTasks([...periodTasks, ...unscheduledTasks])
        setPermissionError(false)
      } catch (firestoreError: any) {
        console.error("Error fetching tasks from Firestore:", firestoreError)

        // Check if it's a permissions error
        if (
          firestoreError.message &&
          (firestoreError.message.includes("permission") ||
            firestoreError.message.includes("Missing or insufficient permissions"))
        ) {
          setPermissionError(true)
          toast({
            title: "Permission Error",
            description: "You don't have permission to access tasks. Using local tasks only.",
            variant: "destructive",
          })
        } else if (firestoreError.message && firestoreError.message.includes("requires an index")) {
          // Extract the index creation URL from the error message
          const indexUrlMatch = firestoreError.message.match(/(https:\/\/console\.firebase\.google\.com\S+)/)
          const indexUrl = indexUrlMatch ? indexUrlMatch[1] : null

          if (indexUrl) {
            setIndexError(indexUrl)
            console.log("Index required. URL:", indexUrl)
          }
        } else {
          // For other errors, set a general error message
          setError(firestoreError.message || "Failed to fetch tasks from the server")
        }
      }
    } catch (error: any) {
      console.error("Error in task fetching process:", error)
      setError(error.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }, [user, view, toast])

  // Fetch tasks effect
  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user, view, fetchTasks])

  // Schedule tasks handler
  const handleScheduleTasks = async () => {
    if (!user) return

    setIsScheduling(true)
    try {
      // Get pending tasks without a schedule
      const pendingTasks = tasks.filter((task) => task.status === "pending" && !task.scheduledTime)

      if (pendingTasks.length === 0) {
        toast({
          title: "No tasks to schedule",
          description: "There are no pending tasks without a schedule.",
        })
        setIsScheduling(false)
        return
      }

      // Run scheduling algorithm
      const scheduledResults = scheduleTasksOptimally(pendingTasks)

      // Update local state first
      setTasks(
        tasks.map((task) => {
          const updatedTask = scheduledResults.find((t) => t.id === task.id)
          return updatedTask || task
        }),
      )

      // If we don't have a permission error, try to update Firestore
      if (!permissionError) {
        // Update tasks in Firestore with new schedule times
        for (const task of scheduledResults) {
          if (task.scheduledTime && !task.id.toString().startsWith("local_")) {
            try {
              await updateTask(
                task.id,
                {
                  scheduledTime: task.scheduledTime,
                },
                user.uid,
              )

              // Create notifications for the task
              try {
                await createTaskReminders(user.uid, task)
              } catch (notificationError: any) {
                console.error("Error creating task reminders:", notificationError)

                // Check if it's a permissions error
                if (
                  notificationError.message &&
                  notificationError.message.includes("Missing or insufficient permissions")
                ) {
                  setNotificationPermissionError(true)
                }
              }

              // Add to Google Calendar if authenticated
              if (calendarAuthenticated) {
                try {
                  await createCalendarEvent(task)
                } catch (calendarError) {
                  console.error("Error adding task to Google Calendar:", calendarError)
                }
              }
            } catch (error: any) {
              console.error(`Error updating task ${task.id}:`, error)

              // Check if it's a permissions error
              if (
                error.message &&
                (error.message.includes("permission") || error.message.includes("Missing or insufficient permissions"))
              ) {
                setPermissionError(true)
                break // Stop trying to update other tasks
              }
            }
          }
        }
      }

      toast({
        title: "Tasks scheduled",
        description: permissionError
          ? "Your tasks have been scheduled optimally (local only)."
          : "Your tasks have been scheduled optimally.",
      })

      // Refresh tasks after scheduling
      fetchTasks()
    } catch (error: any) {
      console.error("Error scheduling tasks:", error)
      toast({
        title: "Scheduling failed",
        description: error.message || "An error occurred while scheduling tasks.",
        variant: "destructive",
      })
    } finally {
      setIsScheduling(false)
    }
  }

  // Connect calendar handler
  const handleConnectCalendar = async () => {
    if (!user) return

    setIsConnectingCalendar(true)
    setCalendarError(null)

    try {
      if (!calendarInitialized) {
        const initialized = await initializeGoogleCalendarOnLoad()
        setCalendarInitialized(initialized)

        if (!initialized) {
          throw new Error("Failed to initialize Google Calendar")
        }
      }

      await signInToGoogle()
      setCalendarAuthenticated(true)

      toast({
        title: "Google Calendar connected",
        description: "Your Google Calendar has been connected successfully.",
      })
    } catch (error: any) {
      console.error("Error connecting to Google Calendar:", error)

      // Set a more user-friendly error message
      let errorMessage = "An error occurred while connecting to Google Calendar."

      if (error.message?.includes("popup")) {
        errorMessage = "Google sign-in popup was blocked. Please allow popups for this site."
      } else if (error.message) {
        errorMessage = error.message
      }

      setCalendarError(errorMessage)

      toast({
        title: "Failed to connect calendar",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsConnectingCalendar(false)
    }
  }

  // Helper functions for task organization
  const getTasksByDate = () => {
    const scheduledTasks = tasks.filter((task) => task.scheduledTime && task.status !== "completed")

    // Group tasks by date
    const groupedTasks: Record<string, Task[]> = {}

    scheduledTasks.forEach((task) => {
      const isoDay = new Date(task.scheduledTime!).toISOString().split("T")[0]
      if (!groupedTasks[isoDay]) {
        groupedTasks[isoDay] = []
      }
      groupedTasks[isoDay].push(task)
    })

    // Sort tasks within each date by time
    Object.keys(groupedTasks).forEach((date) => {
      groupedTasks[date].sort((a, b) => {
        if (!a.scheduledTime || !b.scheduledTime) return 0
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      })
    })

    // Sort dates chronologically
    return Object.keys(groupedTasks)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .reduce((obj: Record<string, Task[]>, key) => {
        obj[key] = groupedTasks[key]
        return obj
      }, {})
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-500 border-red-500/50"
      case "medium":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
      case "low":
        return "bg-green-500/20 text-green-500 border-green-500/50"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/50"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "work":
        return "bg-blue-500/20 text-blue-500 border-blue-500/50"
      case "personal":
        return "bg-purple-500/20 text-purple-500 border-purple-500/50"
      case "study":
        return "bg-indigo-500/20 text-indigo-500 border-indigo-500/50"
      case "health":
        return "bg-emerald-500/20 text-emerald-500 border-emerald-500/50"
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/50"
    }
  }

  // Derived state
  const groupedTasks = getTasksByDate()
  const dates = Object.keys(groupedTasks)
  const unscheduledTasks = tasks.filter((task) => !task.scheduledTime && task.status !== "completed")

  // Loading state
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Main render
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6">
        {user && (
          <>
            {calendarError && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Google Calendar Error</AlertTitle>
                <AlertDescription>
                  <p>{calendarError}</p>
                  <p className="mt-2 text-sm">
                    To use Google Calendar integration, make sure you have enabled the Google Calendar API in your
                    Google Cloud Console and that your OAuth client is configured correctly.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {isPreview && (
              <Alert variant="info" className="mb-6">
                <Info className="h-4 w-4" />
                <AlertTitle>Preview Environment</AlertTitle>
                <AlertDescription>
                  <p>
                    You are in a preview environment. Google Calendar integration is not available in preview
                    environments.
                  </p>
                  <p className="mt-2">
                    In a deployed environment, you would be able to connect to Google Calendar and sync your tasks.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {indexError && (
              <Alert variant="warning" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Firestore Index Required</AlertTitle>
                <AlertDescription>
                  <p>
                    Your tasks are being displayed but may not be in the correct order. To enable proper sorting, you
                    need to create a Firestore index.
                  </p>
                  <div className="mt-2">
                    <a
                      href={indexError}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Create the required index <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-2 text-sm">After creating the index, it may take a few minutes to become active.</p>
                </AlertDescription>
              </Alert>
            )}

            {permissionError && (
              <Alert variant="destructive" className="mb-6">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Firestore Permission Error</AlertTitle>
                <AlertDescription>
                  <p>
                    You don't have permission to access tasks from the database. Tasks will be managed locally only.
                  </p>
                  <p className="mt-2">
                    You can still create, schedule, and manage tasks, but changes won't be saved to the server.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {notificationPermissionError && !permissionError && (
              <Alert variant="warning" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Notification Permission Error</AlertTitle>
                <AlertDescription>
                  <p>You don't have permission to create notifications. Task reminders won't be available.</p>
                  <p className="mt-2">
                    Your tasks will still be scheduled, but you won't receive notifications for them.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h1 className="text-2xl font-bold text-foreground">Task Schedule</h1>
              <div className="flex flex-col sm:flex-row gap-4">
                <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week" | "month")}>
                  <TabsList className="bg-secondary">
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex gap-2">
                  <Button
                    onClick={handleScheduleTasks}
                    disabled={isScheduling || unscheduledTasks.length === 0}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isScheduling ? "animate-spin" : ""}`} />
                    {isScheduling ? "Scheduling..." : "Generate Schedule"}
                  </Button>
                  {!calendarAuthenticated && (
                    <Button
                      onClick={handleConnectCalendar}
                      variant="outline"
                      className="whitespace-nowrap"
                      disabled={isConnectingCalendar}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {isConnectingCalendar ? "Connecting..." : "Connect Calendar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
                  <p className="text-foreground">Loading your schedule...</p>
                </div>
              </div>
            ) : dates.length === 0 && unscheduledTasks.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <Calendar className="mb-4 h-12 w-12 text-primary" />
                  <h3 className="mb-2 text-xl font-medium text-foreground">No tasks to schedule</h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    You don't have any tasks to schedule. Create a new task to get started.
                  </p>
                  <Button
                    onClick={() => router.push("/tasks/new")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Create New Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {unscheduledTasks.length > 0 && (
                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Unscheduled Tasks</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        These tasks need to be scheduled. Click "Generate Schedule" to automatically schedule them.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {unscheduledTasks.map((task) => (
                          <Card key={task.id} className="border-border bg-secondary">
                            <CardContent className="p-4">
                              <h3 className="mb-2 font-medium text-foreground">
                                {task.title}
                                {task.id.toString().startsWith("local_") && (
                                  <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                                )}
                              </h3>
                              {task.description && (
                                <p className="mb-2 text-sm text-muted-foreground">{task.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </Badge>
                                {task.category && (
                                  <Badge variant="outline" className={getCategoryColor(task.category)}>
                                    {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
                                  </Badge>
                                )}
                                {task.duration && (
                                  <Badge
                                    variant="outline"
                                    className="flex items-center gap-1 border-primary/50 bg-primary/20 text-primary"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {task.duration} min
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {dates.map((date) => (
                  <Card key={date} className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">
                        {new Date(date).toLocaleDateString(undefined, {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {groupedTasks[date].length} task{groupedTasks[date].length !== 1 ? "s" : ""} scheduled
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {groupedTasks[date].map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start justify-between rounded-lg border border-border bg-secondary p-4"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-foreground">
                                  {task.title}
                                  {task.id.toString().startsWith("local_") && (
                                    <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                                  )}
                                </h3>
                                <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </Badge>
                              </div>
                              {task.description && (
                                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {task.category && (
                                  <Badge variant="outline" className={getCategoryColor(task.category)}>
                                    {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
                                  </Badge>
                                )}
                                {task.duration && (
                                  <Badge
                                    variant="outline"
                                    className="flex items-center gap-1 border-primary/50 bg-primary/20 text-primary"
                                  >
                                    <Clock className="h-3 w-3" />
                                    {task.duration} min
                                  </Badge>
                                )}
                                {task.calendarEventId && (
                                  <Badge
                                    variant="outline"
                                    className="flex items-center gap-1 border-green-500/50 bg-green-500/20 text-green-500"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    Added to Calendar
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {task.scheduledTime && (
                                <div className="text-sm font-medium text-primary">
                                  {new Date(task.scheduledTime).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <ChatInterface />
    </div>
  )
}
