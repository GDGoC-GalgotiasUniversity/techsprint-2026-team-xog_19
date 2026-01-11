// Task service for managing tasks in Firestore
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  getDoc,
  Timestamp,
} from "firebase/firestore"
import { getFirestore } from "@/lib/firebase" // Changed from getFirebaseFirestore
import type { Task } from "@/types/task"
import { createTaskReminders } from "./notification-service"
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarSettings } from "./calendar-service"

export function isPreviewEnvironment(): boolean {
  // only treat as "preview" when running locally in dev AND
  // NEXT_PUBLIC_USE_LOCAL_TASKS is explicitly true
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_LOCAL_TASKS === "true"
}

// Improve the createTask function with better error handling and retries
export async function createTask(task: Partial<Task>, userId: string): Promise<string> {
  let retries = 0
  const maxRetries = 3

  while (retries <= maxRetries) {
    try {
      // In preview environments, use a mock task ID
      if (isPreviewEnvironment()) {
        console.log("Preview environment detected, using mock task creation")

        // Create a mock task ID
        const mockTaskId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        // Store in localStorage for persistence
        try {
          const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
          localTasks.push({
            id: mockTaskId,
            ...task,
            user_id: userId,
            createdAt: new Date().toISOString(),
          })
          localStorage.setItem("local_tasks", JSON.stringify(localTasks))
        } catch (storageError) {
          console.warn("Could not save task to local storage", storageError)
        }

        // Skip Firestore operations in preview
        return mockTaskId
      }

      const firestore = await getFirestore()
      if (!firestore) {
        throw new Error("Firestore is not initialized")
      }

      // Validate deadline if present
      if (task.deadline && task.duration) {
        const currentTime = new Date()
        const deadlineTime = new Date(task.deadline)
        const taskDurationMs = task.duration * 60 * 1000 // Convert minutes to milliseconds

        // Check if task can be completed before deadline
        if (currentTime.getTime() + taskDurationMs > deadlineTime.getTime()) {
          throw new Error("Task cannot be completed before the deadline. Please adjust the duration or deadline.")
        }
      }

      // Prepare task data
      const taskData = {
        title: task.title || "New Task",
        description: task.description || "",
        priority: task.priority || "medium",
        category: task.category || "work",
        duration: task.duration || 60,
        status: "pending",
        user_id: userId,
        createdAt: serverTimestamp(),
        complexity: task.complexity || "medium",
        ...(task.deadline ? { deadline: task.deadline } : {}),
        ...(task.scheduledTime ? { scheduledTime: task.scheduledTime } : {}),
      }

      // Add to Firestore
      const docRef = await addDoc(collection(firestore, "tasks"), taskData)

      // Create task reminders
      if (task.deadline || task.scheduledTime) {
        try {
          await createTaskReminders(userId, { id: docRef.id, ...taskData })
        } catch (reminderError) {
          console.warn("Failed to create task reminders, but task was created:", reminderError)
          // Continue execution even if reminders fail
        }
      }

      // Add to Google Calendar if enabled
      try {
        const calendarSettings = await getCalendarSettings(userId)
        if (calendarSettings.enabled && calendarSettings.syncEnabled && task.scheduledTime) {
          await createCalendarEvent({ id: docRef.id, ...taskData }, calendarSettings.calendarId)
        }
      } catch (calendarError) {
        console.warn("Error syncing task to calendar:", calendarError)
        // Continue execution even if calendar sync fails
      }

      return docRef.id
    } catch (error: any) {
      retries++

      // Check if it's a permission error - don't retry these
      if (error.message && error.message.includes("permission")) {
        console.error("Permission error creating task:", error)
        throw error
      }

      // Check if it's a validation error - don't retry these
      if (error.message && error.message.includes("cannot be completed before the deadline")) {
        throw error
      }

      // For connectivity issues, retry with exponential backoff
      if (retries <= maxRetries) {
        console.warn(`Task creation failed, retrying (${retries}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)))
        continue
      }

      console.error("Error creating task after retries:", error)
      throw error
    }
  }

  throw new Error("Failed to create task after multiple attempts")
}

/**
 * Update an existing task in Firestore
 */
export async function updateTask(taskId: string, updates: Partial<Task>, userId: string): Promise<void> {
  try {
    // In preview environments, update local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for task update")

      try {
        const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
        const updatedTasks = localTasks.map((task: any) => {
          if (task.id === taskId && task.user_id === userId) {
            return { ...task, ...updates, updatedAt: new Date().toISOString() }
          }
          return task
        })
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks))
      } catch (storageError) {
        console.warn("Could not update task in local storage", storageError)
      }

      return
    }

    const firestore = await getFirestore() // Changed from getFirebaseFirestore
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    // Get the current task data
    const taskDoc = await getDoc(doc(firestore, "tasks", taskId))
    if (!taskDoc.exists()) {
      throw new Error("Task not found")
    }

    const currentTask = taskDoc.data() as Task

    // Verify the task belongs to the user
    if (currentTask.user_id !== userId) {
      // IMPORTANT: Using user_id to match security rules
      throw new Error("You don't have permission to update this task")
    }

    // Validate deadline if present and duration is being updated
    if (
      (updates.deadline || currentTask.deadline) &&
      (updates.duration || currentTask.duration) &&
      !updates.scheduledTime
    ) {
      const currentTime = new Date()
      const deadlineTime = new Date(updates.deadline || currentTask.deadline || "")
      const taskDurationMs = (updates.duration || currentTask.duration || 60) * 60 * 1000

      // Check if task can be completed before deadline
      if (currentTime.getTime() + taskDurationMs > deadlineTime.getTime()) {
        throw new Error("Task cannot be completed before the deadline. Please adjust the duration or deadline.")
      }
    }

    // Prepare update data
    const updateData: Record<string, any> = {}

    // Only include defined fields
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value
      }
    })

    // Add last updated timestamp
    updateData.updatedAt = serverTimestamp()

    // Update in Firestore
    await updateDoc(doc(firestore, "tasks", taskId), updateData)

    // Update task reminders if deadline or scheduledTime changed
    if (updates.deadline || updates.scheduledTime) {
      // Delete existing reminders and create new ones
      await createTaskReminders(userId, {
        id: taskId,
        ...currentTask,
        ...updates,
      })
    }

    // Update in Google Calendar if needed
    try {
      const calendarSettings = await getCalendarSettings(userId)

      if (calendarSettings.enabled && calendarSettings.syncEnabled) {
        const updatedTask = { ...currentTask, ...updates, id: taskId }

        if (updatedTask.calendarEventId) {
          // Update existing calendar event
          await updateCalendarEvent(updatedTask)
        } else if (updatedTask.scheduledTime) {
          // Create new calendar event
          await createCalendarEvent(updatedTask, calendarSettings.calendarId)
        }
      }
    } catch (calendarError) {
      console.error("Error syncing task to calendar:", calendarError)
      // Continue execution even if calendar sync fails
    }
  } catch (error) {
    console.error("Error updating task:", error)
    throw error
  }
}

/**
 * Delete a task from Firestore
 */
export async function deleteTask(taskId: string, userId: string): Promise<void> {
  try {
    // In preview environments, delete from local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for task deletion")

      try {
        const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
        const filteredTasks = localTasks.filter((task: any) => !(task.id === taskId && task.user_id === userId))
        localStorage.setItem("local_tasks", JSON.stringify(filteredTasks))

        // Also clean up any local notifications for this task
        try {
          const localNotificationsKey = "local_notifications"
          const notifications = JSON.parse(localStorage.getItem(localNotificationsKey) || "[]")
          const filteredNotifications = notifications.filter((notification: any) => notification.taskId !== taskId)
          localStorage.setItem(localNotificationsKey, JSON.stringify(filteredNotifications))
        } catch (notificationError) {
          console.warn("Could not delete local notifications for task", notificationError)
        }
      } catch (storageError) {
        console.warn("Could not delete task from local storage", storageError)
      }

      return
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    // Get the task to verify ownership and get calendar info
    const taskDoc = await getDoc(doc(firestore, "tasks", taskId))
    if (!taskDoc.exists()) {
      throw new Error("Task not found")
    }

    const task = taskDoc.data() as Task

    // Verify the task belongs to the user
    if (task.user_id !== userId) {
      throw new Error("You don't have permission to delete this task")
    }

    // Delete from Firestore
    await deleteDoc(doc(firestore, "tasks", taskId))

    // Delete from Google Calendar if needed
    try {
      if (task.calendarEventId) {
        await deleteCalendarEvent(task)
      }
    } catch (calendarError) {
      console.error("Error removing task from calendar:", calendarError)
      // Continue execution even if calendar deletion fails
    }

    // Delete associated notifications
    try {
      const notificationsQuery = query(collection(firestore, "notifications"), where("taskId", "==", taskId))
      const notificationsSnapshot = await getDocs(notificationsQuery)

      const deletePromises = notificationsSnapshot.docs.map((notificationDoc) =>
        deleteDoc(doc(firestore, "notifications", notificationDoc.id)),
      )

      await Promise.all(deletePromises)
    } catch (notificationError: any) {
      // Check if it's a permissions error
      if (notificationError.message && notificationError.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot delete notifications due to insufficient permissions - continuing with task deletion")
        // Don't throw the error, just log it and continue
      } else {
        console.error("Error deleting task notifications:", notificationError)
        // Still don't throw for other notification errors to ensure task deletion completes
      }
    }
  } catch (error) {
    console.error("Error deleting task:", error)
    throw error
  }
}

// Improve the getUserTasks function with better error handling
export async function getUserTasks(userId: string): Promise<Task[]> {
  let retries = 0
  const maxRetries = 3

  while (retries <= maxRetries) {
    try {
      // In preview environments, use local storage
      if (isPreviewEnvironment()) {
        console.log("Preview environment detected, using local storage for tasks")

        try {
          const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
          const userTasks = localTasks.filter((task: any) => task.user_id === userId)

          // Sort tasks by createdAt (newest first)
          return userTasks.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateB - dateA
          })
        } catch (storageError) {
          console.warn("Could not get tasks from local storage", storageError)
          return []
        }
      }

      const firestore = await getFirestore()
      if (!firestore) {
        throw new Error("Firestore is not initialized")
      }

      // Query tasks for the user
      // IMPORTANT: Using user_id to match security rules
      const tasksQuery = query(collection(firestore, "tasks"), where("user_id", "==", userId))

      const querySnapshot = await getDocs(tasksQuery)
      const tasks: Task[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()

        // Helper function to safely convert any timestamp format to ISO string
        const convertTimestampToISOString = (timestamp: any): string | undefined => {
          if (!timestamp) return undefined

          // Case 1: Firestore Timestamp object
          if (timestamp instanceof Timestamp) {
            return timestamp.toDate().toISOString()
          }

          // Case 2: Date object
          if (timestamp instanceof Date) {
            return timestamp.toISOString()
          }

          // Case 3: Object with toDate method (Firestore Timestamp-like)
          if (
            timestamp &&
            typeof timestamp === "object" &&
            "toDate" in timestamp &&
            typeof timestamp.toDate === "function"
          ) {
            try {
              return timestamp.toDate().toISOString()
            } catch (e) {
              console.warn("Failed to convert timestamp using toDate()", e)
            }
          }

          // Case 4: String that can be parsed as date
          if (typeof timestamp === "string") {
            try {
              return new Date(timestamp).toISOString()
            } catch (e) {
              console.warn("Failed to parse date string", e)
            }
          }

          // Case 5: Number (milliseconds since epoch)
          if (typeof timestamp === "number") {
            return new Date(timestamp).toISOString()
          }

          // Default: current date
          console.warn("Unknown timestamp format, using current date", timestamp)
          return new Date().toISOString()
        }

        // Convert Firestore timestamps to ISO strings safely
        const task: Task = {
          id: doc.id,
          ...data,
          createdAt: convertTimestampToISOString(data.createdAt) || new Date().toISOString(),
          updatedAt: convertTimestampToISOString(data.updatedAt),
          deadline: data.deadline || undefined,
          scheduledTime: data.scheduledTime || undefined,
        } as Task

        tasks.push(task)
      })

      // Sort tasks by createdAt (newest first)
      return tasks.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
    } catch (error: any) {
      retries++

      // Check if it's a permission error - don't retry these
      if (error.message && error.message.includes("permission")) {
        console.error("Permission error fetching tasks:", error)
        throw error
      }

      // For connectivity issues, retry with exponential backoff
      if (retries <= maxRetries) {
        console.warn(`Task fetching failed, retrying (${retries}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)))
        continue
      }

      console.error("Error fetching tasks after retries:", error)
      throw error
    }
  }

  throw new Error("Failed to fetch tasks after multiple attempts")
}

/**
 * Get tasks for a specific time period
 */
export async function getTasksForPeriod(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
  try {
    // In preview environments, use local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for period tasks")

      try {
        const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
        const userTasks = localTasks.filter((task: any) => {
          if (task.user_id !== userId) return false

          if (task.scheduledTime) {
            const taskDate = new Date(task.scheduledTime)
            return taskDate >= startDate && taskDate <= endDate
          }
          return false
        })

        return userTasks
      } catch (storageError) {
        console.warn("Could not get period tasks from local storage", storageError)
        return []
      }
    }

    const firestore = await getFirestore() // Changed from getFirebaseFirestore
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    // Get all user tasks (we'll filter client-side to avoid complex queries)
    const tasks = await getUserTasks(userId)

    // Filter tasks that fall within the time period
    return tasks.filter((task) => {
      if (task.scheduledTime) {
        const taskDate = new Date(task.scheduledTime)
        return taskDate >= startDate && taskDate <= endDate
      }
      return false
    })
  } catch (error) {
    console.error("Error fetching tasks for period:", error)
    throw error
  }
}

/**
 * Get tasks statistics for analytics
 */
export async function getTasksStatistics(userId: string): Promise<{
  total: number
  completed: number
  pending: number
  overdue: number
  categoryBreakdown: Record<string, number>
  priorityBreakdown: Record<string, number>
}> {
  try {
    const tasks = await getUserTasks(userId)
    const now = new Date()

    // Calculate statistics
    const completed = tasks.filter((task) => task.status === "completed").length
    const pending = tasks.filter((task) => task.status === "pending").length

    // Calculate overdue tasks
    const overdue = tasks.filter((task) => {
      if (task.status === "pending" && task.deadline) {
        const deadlineDate = new Date(task.deadline)
        return deadlineDate < now
      }
      return false
    }).length

    // Calculate category breakdown
    const categoryBreakdown: Record<string, number> = {}
    tasks.forEach((task) => {
      const category = task.category || "uncategorized"
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
    })

    // Calculate priority breakdown
    const priorityBreakdown: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0,
    }
    tasks.forEach((task) => {
      const priority = task.priority || "medium"
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1
    })

    return {
      total: tasks.length,
      completed,
      pending,
      overdue,
      categoryBreakdown,
      priorityBreakdown,
    }
  } catch (error) {
    console.error("Error calculating task statistics:", error)
    throw error
  }
}

/**
 * Mark a task as completed or pending
 */
export async function toggleTaskStatus(taskId: string, userId: string, newStatus?: string): Promise<void> {
  try {
    // In preview environments, update local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for task status toggle")

      try {
        const localTasks = JSON.parse(localStorage.getItem("local_tasks") || "[]")
        const updatedTasks = localTasks.map((task: any) => {
          if (task.id === taskId && task.user_id === userId) {
            // If newStatus is provided, use it; otherwise toggle the current status
            const status = newStatus || (task.status === "pending" ? "completed" : "pending")
            return {
              ...task,
              status: status,
              completedAt: status === "completed" ? new Date().toISOString() : null,
            }
          }
          return task
        })
        localStorage.setItem("local_tasks", JSON.stringify(updatedTasks))
      } catch (storageError) {
        console.warn("Could not toggle task status in local storage", storageError)
      }

      return
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    // Get the current task
    const taskDoc = await getDoc(doc(firestore, "tasks", taskId))
    if (!taskDoc.exists()) {
      throw new Error("Task not found")
    }

    const task = taskDoc.data() as Task

    // Verify the task belongs to the user
    if (task.user_id !== userId) {
      // IMPORTANT: Using user_id to match security rules
      throw new Error("You don't have permission to update this task")
    }

    // Determine the new status
    const status = newStatus || (task.status === "pending" ? "completed" : "pending")

    // Update in Firestore
    await updateDoc(doc(firestore, "tasks", taskId), {
      status: status,
      completedAt: status === "completed" ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error toggling task status:", error)
    throw error
  }
}

/**
 * Fuzzy‐delete by title.
 */
export async function deleteTaskByTitle(fuzzyTitle: string, userId: string): Promise<void> {
  try {
    const tasks = await getUserTasks(userId)
    const match = findClosestTask(tasks, fuzzyTitle)
    if (!match) throw new Error(`No task found matching "${fuzzyTitle}"`)

    await deleteTask(match.id, userId)
  } catch (error: any) {
    console.error("Error in deleteTaskByTitle:", error)
    // Re-throw the error with the original message to maintain error handling upstream
    throw error
  }
}

/**
 * Fuzzy‐complete by title.
 */
export async function completeTaskByTitle(fuzzyTitle: string, userId: string): Promise<void> {
  const tasks = await getUserTasks(userId)
  const match = findClosestTask(tasks, fuzzyTitle)
  if (!match) throw new Error(`No task found matching "${fuzzyTitle}"`)
  await toggleTaskStatus(match.id, userId, "completed")
}

/** Normalize for fuzzy matching */
function normalize(str: string): string {
  return str.trim().toLowerCase()
}

/** Find closest by Levenshtein */
function findClosestTask(tasks: Task[], rawTitle: string, maxDistance = 3): Task | null {
  const target = normalize(rawTitle)
  let best: Task | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const t of tasks) {
    const score = distance(normalize(t.title), target)
    if (score < bestScore) {
      bestScore = score
      best = t
    }
  }

  return bestScore <= maxDistance ? best : null
}

// Levenshtein distance algorithm
function distance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  // increment along the first column of each row
  let i
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  // increment each column in the first row
  let j
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1,
        ) // deletion
      }
    }
  }

  return matrix[b.length][a.length]
}
