"use client"

import { useState } from "react"
import type { Task } from "@/types/task"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Clock, Trash, AlertTriangle, Calendar } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toggleTaskStatus, deleteTask } from "@/lib/task-service"
import { useAuth } from "@/hooks/use-auth"

// ── Helper functions (added) ─────────────────────────────────────────────────
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
// ── End helpers ───────────────────────────────────────────────────────────────

interface TaskListProps {
  tasks: Task[]
  loading: boolean
  permissionError?: boolean
  onTaskUpdate?: () => Promise<void> | void
}

export default function TaskList({ tasks, loading, permissionError = false, onTaskUpdate }: TaskListProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleStatusChange = async (task: Task) => {
    if (!user) return

    setUpdatingId(task.id)
    try {
      // Toggle the status
      const newStatus = task.status === "pending" ? "completed" : "pending"

      await toggleTaskStatus(task.id, user.uid, newStatus)

      toast({
        title: "Task updated",
        description: `Marked "${task.title}" as ${newStatus}.`,
      })

      if (onTaskUpdate) {
        await onTaskUpdate()
      }
    } catch (error: any) {
      console.error("Error updating task status:", error)
      toast({
        title: "Failed to update task",
        description: error.message || "An error occurred while updating the task status.",
        variant: "destructive",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return

    setDeletingId(taskId)
    try {
      await deleteTask(taskId, user.uid)

      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      })

      if (onTaskUpdate) {
        await onTaskUpdate()
      }
    } catch (error: any) {
      console.error("Error deleting task:", error)
      toast({
        title: "Failed to delete task",
        description: error.message || "An error occurred while deleting the task.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="py-4 text-center text-muted-foreground">Loading tasks...</div>
  }

  // ← only render the tasks passed in
  const allTasks = tasks

  if (allTasks.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground">
        No tasks found. Create your first task to get started!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {permissionError && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Due to permission issues, task changes will only be saved locally and won't be synchronized with the server.
          </AlertDescription>
        </Alert>
      )}

      {allTasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start justify-between rounded-lg border border-border bg-secondary p-4"
        >
          <div className="flex items-start space-x-4">
            <Checkbox
              checked={task.status === "completed"}
              onCheckedChange={() => handleStatusChange(task)}
              disabled={updatingId === task.id}
              className="mt-1 border-primary text-primary"
            />
            <div>
              <h3
                className={`font-medium text-foreground ${
                  task.status === "completed" ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
                {task.id.toString().startsWith("local_") && (
                  <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                )}
              </h3>
              {task.description && (
                <p
                  className={`mt-1 text-sm text-muted-foreground ${task.status === "completed" ? "line-through" : ""}`}
                >
                  {task.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                {task.deadline && (
                  <Badge variant="outline" className="border-red-500/50 bg-red-500/20 text-red-500">
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </Badge>
                )}
                {task.scheduledTime && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 border-blue-500/50 bg-blue-500/20 text-blue-500"
                  >
                    <Calendar className="h-3 w-3" />
                    {new Date(task.scheduledTime).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={deletingId === task.id}
              >
                {deletingId === task.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Trash className="h-4 w-4" />
                )}
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="border-border bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm delete</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{task.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDeleteTask(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  )
}
