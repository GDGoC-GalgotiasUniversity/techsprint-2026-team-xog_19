"use client"

import { useEffect, useState } from "react"
import type { Task } from "@/types/task"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Calendar, Clock, RefreshCw, CalendarIcon, AlertTriangle } from "lucide-react"
import { scheduleTasksOptimally } from "@/lib/scheduler"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import {
  createCalendarEvent,
  getCalendarSettings,
  isGoogleAuthenticated,
  isGoogleApiAvailable,
} from "@/lib/calendar-service"
import { createTaskReminders } from "@/lib/notification-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface TaskScheduleProps {
  tasks: Task[]
  loading: boolean
  permissionError?: boolean
}

export default function TaskSchedule({ tasks, loading, permissionError = false }: TaskScheduleProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([])
  const [isScheduling, setIsScheduling] = useState(false)
  const [calendarSettings, setCalendarSettings] = useState<any>(null)
  const [calendarSyncAvailable, setCalendarSyncAvailable] = useState(false)

  useEffect(() => {
    // Filter tasks that have scheduledTime
    const tasksWithSchedule = tasks.filter((task) => task.scheduledTime && task.status !== "completed")

    // Sort by scheduledTime
    const sorted = [...tasksWithSchedule].sort((a, b) => {
      if (!a.scheduledTime || !b.scheduledTime) return 0
      return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    })

    setScheduledTasks(sorted)
  }, [tasks])

  useEffect(() => {
    const loadCalendarSettings = async () => {
      if (!user || permissionError) return

      try {
        // Check if Google API is available
        const apiAvailable = isGoogleApiAvailable()

        if (!apiAvailable) {
          setCalendarSyncAvailable(false)
          return
        }

        const settings = await getCalendarSettings(user.uid)
        setCalendarSettings(settings)
        setCalendarSyncAvailable(settings.enabled && settings.syncEnabled && isGoogleAuthenticated())
      } catch (error) {
        console.error("Error loading calendar settings:", error)
        setCalendarSyncAvailable(false)
      }
    }

    if (user) {
      loadCalendarSettings()
    }
  }, [user, permissionError])

  const handleScheduleTasks = async () => {
    if (!user) return

    setIsScheduling(true)
    try {
      // Get pending tasks without a schedule
      const pendingTasks = tasks.filter((task) => task.status === "pending")

      // Run scheduling algorithm
      const scheduledResults = scheduleTasksOptimally(pendingTasks)

      // Update local state first
      setScheduledTasks(scheduledResults.filter((task) => task.scheduledTime && task.status !== "completed"))

      // If we don't have a permission error, try to update Firestore
      if (!permissionError) {
        // Update tasks in Firestore with new schedule times
        for (const task of scheduledResults) {
          if (task.scheduledTime) {
            try {
              await updateDoc(doc(db, "tasks", task.id), {
                scheduledTime: task.scheduledTime,
              })

              // Create notifications for the task
              try {
                await createTaskReminders(user.uid, task)
              } catch (error) {
                console.error("Error creating task reminders:", error)
                // Continue execution even if notifications fail
              }

              // Sync to calendar if enabled and available
              if (calendarSyncAvailable) {
                try {
                  // Check if task already has a calendar event
                  const taskDoc = await getDoc(doc(db, "tasks", task.id))
                  const taskData = taskDoc.data()

                  if (!taskData?.calendarEventId) {
                    await createCalendarEvent(task, calendarSettings.calendarId)
                  }
                } catch (error) {
                  console.error("Error syncing task to calendar:", error)
                }
              }
            } catch (error) {
              console.error("Error updating task in Firestore:", error)
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
    } catch (error) {
      toast({
        title: "Scheduling failed",
        description: "An error occurred while scheduling tasks.",
        variant: "destructive",
      })
    } finally {
      setIsScheduling(false)
    }
  }

  const handleSyncToCalendar = async () => {
    if (!user || !calendarSettings || scheduledTasks.length === 0 || !calendarSyncAvailable || permissionError) return

    try {
      let syncCount = 0

      for (const task of scheduledTasks) {
        // Check if task already has a calendar event
        const taskDoc = await getDoc(doc(db, "tasks", task.id))
        const taskData = taskDoc.data()

        if (!taskData?.calendarEventId && task.scheduledTime) {
          const eventId = await createCalendarEvent(task, calendarSettings.calendarId)
          if (eventId) syncCount++
        }
      }

      toast({
        title: "Tasks synced to calendar",
        description: `${syncCount} tasks have been synced to your Google Calendar.`,
      })
    } catch (error: any) {
      toast({
        title: "Calendar sync failed",
        description: error.message || "An error occurred while syncing tasks to calendar.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div className="py-4 text-center">Loading schedule...</div>
  }

  return (
    <div className="space-y-4">
      {permissionError && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Limited Functionality</AlertTitle>
          <AlertDescription>
            Due to permission issues, task scheduling will only work locally and won't be saved to the server.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button onClick={handleScheduleTasks} disabled={isScheduling}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {isScheduling ? "Scheduling..." : "Generate Optimal Schedule"}
        </Button>

        {calendarSyncAvailable && scheduledTasks.length > 0 && !permissionError && (
          <Button variant="outline" onClick={handleSyncToCalendar}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            Sync to Google Calendar
          </Button>
        )}
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="py-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No scheduled tasks</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Click the button above to generate an optimal schedule for your pending tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledTasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{task.title}</h3>
                    {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          task.priority === "high"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                            : task.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        }`}
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>

                      {task.complexity && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            task.complexity === "high"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              : task.complexity === "medium"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          }`}
                        >
                          Complexity: {task.complexity.charAt(0).toUpperCase() + task.complexity.slice(1)}
                        </span>
                      )}

                      {task.calendarEventId && !permissionError && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          Synced
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm font-medium text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      {task.scheduledTime &&
                        new Date(task.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Duration: {task.duration} min</div>
                    {task.scheduledTime && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(task.scheduledTime).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
