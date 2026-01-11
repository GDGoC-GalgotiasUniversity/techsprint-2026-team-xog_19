// Notification service for in-app and browser notifications
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore"
import { getFirestore } from "@/lib/firebase"
import type { Task } from "@/types/task"
import type { TaskNotification, NotificationType, NotificationStatus } from "@/types/notification"

// Local storage key for notifications
const LOCAL_NOTIFICATIONS_KEY = "local_notifications"

/**
 * Check if browser notifications are supported and permission is granted
 */
export function areBrowserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

/**
 * Request permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!areBrowserNotificationsSupported()) {
    return false
  }

  if (Notification.permission === "granted") {
    return true
  }

  const permission = await Notification.requestPermission()
  return permission === "granted"
}

 export function isPreviewEnvironment(): boolean {
  // only treat as “preview” when running locally in dev AND
  // NEXT_PUBLIC_USE_LOCAL_TASKS is explicitly true
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_LOCAL_TASKS === "true"
  );
}

/**
 * Save a notification to local storage
 */
function saveNotificationToLocalStorage(notification: Partial<TaskNotification>): string {
  try {
    const id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const localNotification = {
      ...notification,
      id,
      createdAt: new Date().toISOString(),
    }

    const existingNotifications = getLocalNotifications()
    existingNotifications.push(localNotification as TaskNotification)

    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(existingNotifications))

    return id
  } catch (error) {
    console.error("Error saving notification to local storage:", error)
    return ""
  }
}

/**
 * Get notifications from local storage
 */
function getLocalNotifications(): TaskNotification[] {
  try {
    const notificationsJson = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY)
    return notificationsJson ? JSON.parse(notificationsJson) : []
  } catch (error) {
    console.error("Error getting notifications from local storage:", error)
    return []
  }
}

/**
 * Create a notification for a task
 */
export async function createTaskNotification(
  user_id: string,
  task: Task,
  notificationType: NotificationType,
  notifyAt: Date,
): Promise<string | null> {
  try {
    const notificationData = {
      user_id,
      taskId: task.id,
      taskTitle: task.title,
      notificationType,
      notifyAt: notifyAt.toISOString(),
      status: "pending" as const,
      createdAt: serverTimestamp(),
    }

    // In preview environments, always use local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for notifications")
      return saveNotificationToLocalStorage(notificationData)
    }

    const firestore = await getFirestore()
    if (!firestore) {
      // Fall back to local storage if Firestore is not available
      return saveNotificationToLocalStorage(notificationData)
    }

    try {
      // Try to add to Firestore first
      const docRef = await addDoc(collection(firestore, "notifications"), notificationData)
      return docRef.id
    } catch (firestoreError: any) {
      // Check if it's a permissions error
      if (firestoreError.message && firestoreError.message.includes("Missing or insufficient permissions")) {
        console.warn("Notification creation falling back to local storage due to insufficient permissions")

        // Fall back to local storage
        return saveNotificationToLocalStorage(notificationData)
      }

      // Rethrow other errors
      throw firestoreError
    }
  } catch (error: any) {
    console.error("Error creating notification:", error)

    // Don't throw the error, just return null
    return null
  }
}

// Create task reminders in Firestore
export async function createTaskReminders(user_id: string, task: Task): Promise<void> {
  try {
    // In preview environments, skip Firestore operations
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, skipping Firestore reminders")
      return
    }

    const firestore = await getFirestore()
    if (!firestore) {
      console.warn("Firestore is not initialized, skipping reminders")
      return
    }

    // Try to delete existing reminders, but don't fail if it doesn't work
    try {
      await deleteTaskReminders(task.id)
    } catch (deleteError) {
      console.warn("Could not delete existing reminders, continuing with creation", deleteError)
      // Continue execution even if deletion fails
    }

    // Create notifications collection reference
    const notificationsCollection = collection(firestore, "notifications")

    // Create reminders based on task properties
    const reminders = []

    // If task has a deadline, create a reminder 1 hour before
    if (task.deadline) {
      const deadlineDate = new Date(task.deadline)
      const reminderDate = new Date(deadlineDate.getTime() - 60 * 60 * 1000) // 1 hour before

      // Only create reminder if it's in the future
      if (reminderDate > new Date()) {
        reminders.push({
          user_id: user_id,
          taskId: task.id,
          title: "Deadline Approaching",
          message: `Task "${task.title}" is due in 1 hour`,
          type: "deadline",
          time: Timestamp.fromDate(reminderDate),
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    }

    // If task has a scheduled time, create a reminder 15 minutes before
    if (task.scheduledTime) {
      const scheduledDate = new Date(task.scheduledTime)
      const reminderDate = new Date(scheduledDate.getTime() - 15 * 60 * 1000) // 15 minutes before

      // Only create reminder if it's in the future
      if (reminderDate > new Date()) {
        reminders.push({
          user_id: user_id,
          taskId: task.id,
          title: "Task Starting Soon",
          message: `Task "${task.title}" is scheduled to start in 15 minutes`,
          type: "scheduled",
          time: Timestamp.fromDate(reminderDate),
          read: false,
          createdAt: serverTimestamp(),
        })
      }
    }

    // If no reminders to create, exit early
    if (reminders.length === 0) {
      return
    }

    // Try to add reminders to Firestore
    try {
      const addPromises = reminders.map((reminder) => addDoc(notificationsCollection, reminder))
      await Promise.all(addPromises)
    } catch (addError: any) {
      // Check if it's a permissions error
      if (addError.message && addError.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot create reminders due to insufficient permissions, using local storage")

        // Fall back to local storage for reminders
        reminders.forEach((reminder) => {
          const localNotification = {
            user_id,
            taskId: task.id,
            taskTitle: task.title,
            notificationType: reminder.type as NotificationType,
            notifyAt: reminder.time.toDate().toISOString(),
            status: "pending" as NotificationStatus,
          }
          saveNotificationToLocalStorage(localNotification)
        })
        return
      }

      // For other errors, log but don't throw
      console.error("Error creating reminders:", addError)
    }
  } catch (error) {
    console.warn("Error creating task reminders:", error)
    // Don't throw the error to prevent task creation from failing
  }
}

// Delete task reminders from Firestore
export async function deleteTaskReminders(taskId: string): Promise<void> {
  try {
    // In preview environments, skip Firestore operations
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, skipping Firestore reminder deletion")
      return
    }

    const firestore = await getFirestore()
    if (!firestore) {
      console.warn("Firestore is not initialized, skipping reminder deletion")
      return
    }

    // Query for reminders related to this task
    const notificationsCollection = collection(firestore, "notifications")
    const remindersQuery = query(notificationsCollection, where("taskId", "==", taskId))

    try {
      const querySnapshot = await getDocs(remindersQuery)

      // Delete each reminder
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref))
      await Promise.all(deletePromises)
    } catch (error: any) {
      // Check if it's a permissions error
      if (error.message && error.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot delete reminders due to insufficient permissions")

        // For local storage, we can still delete local notifications
        if (typeof window !== "undefined") {
          const localNotifications = getLocalNotifications()
          const updatedNotifications = localNotifications.filter((n) => n.taskId !== taskId)
          localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications))
        }

        // Don't throw the error to allow the calling function to continue
        return
      }

      // For other errors, rethrow
      throw error
    }
  } catch (error) {
    console.warn("Error deleting task reminders:", error)
    // Don't throw the error to prevent task creation from failing
  }
}

/**
 * Get pending notifications for a user
 */
export async function getPendingNotifications(user_id: string): Promise<TaskNotification[]> {
  try {
    // In preview environments, use local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for notifications")
      return getLocalNotifications().filter((n) => n.user_id === user_id && n.status === "pending")
    }

    // First, try to get notifications from Firestore
    try {
      const firestore = await getFirestore()
      if (!firestore) {
        throw new Error("Firestore not initialized")
      }

      const q = query(
        collection(firestore, "notifications"),
        where("user_id", "==", user_id),
        where("status", "==", "pending"),
        orderBy("notifyAt", "asc"),
      )

      const querySnapshot = await getDocs(q)
      const notifications: TaskNotification[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (
          !data.user_id ||
          !data.taskId ||
          !data.taskTitle ||
          !data.notificationType ||
          !data.notifyAt ||
          !data.status
        ) {
          console.error("Invalid notification data:", data)
          return
        }

        const notification: TaskNotification = {
          id: doc.id,
          user_id: data.user_id,
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          notificationType: data.notificationType as NotificationType,
          notifyAt: typeof data.notifyAt === "string" ? data.notifyAt : data.notifyAt.toDate().toISOString(),
          status: data.status as NotificationStatus,
        }

        if (data.createdAt) {
          notification.createdAt =
            data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt
        }

        if (data.sentAt) {
          notification.sentAt = data.sentAt instanceof Timestamp ? data.sentAt.toDate().toISOString() : data.sentAt
        }

        if (data.readAt) {
          notification.readAt = data.readAt instanceof Timestamp ? data.readAt.toDate().toISOString() : data.readAt
        }

        notifications.push(notification)
      })

      return notifications
    } catch (firestoreError: any) {
      // Check if it's a permissions error
      if (firestoreError.message && firestoreError.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot fetch notifications from Firestore due to insufficient permissions, using local storage")

        // Fall back to local storage
        return getLocalNotifications().filter((n) => n.user_id === user_id && n.status === "pending")
      }

      // Rethrow other errors
      throw firestoreError
    }
  } catch (error: any) {
    console.error("Error fetching notifications:", error)

    // Return empty array for all errors to prevent app from crashing
    return []
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    // Check if it's a local notification
    if (notificationId.startsWith("local_")) {
      const notifications = getLocalNotifications()
      const updatedNotifications = notifications.map((n) => {
        if (n.id === notificationId) {
          return {
            ...n,
            status: "read" as const,
            readAt: new Date().toISOString(),
          }
        }
        return n
      })
      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications))
      return
    }

    // In preview environments, skip Firestore operations
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, skipping Firestore notification update")
      return
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    try {
      await deleteDoc(doc(firestore, "notifications", notificationId))
    } catch (error: any) {
      // Check if it's a permissions error
      if (error.message && error.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot mark notification as read due to insufficient permissions")
        return
      }
      throw error
    }
  } catch (error) {
    console.error("Error marking notification as read:", error)
    // Don't throw to prevent UI from breaking
  }
}

// Subscribe to notifications for a user
export async function subscribeToNotifications(
  user_id: string,
  callback: (notifications: any[]) => void,
): Promise<() => void> {
  try {
    // In preview environments, use local storage and return a mock unsubscribe function
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for notifications subscription")

      // Initial callback with local notifications
      const localNotifications = getLocalNotifications()
        .filter((n) => n.user_id === user_id)
        .map((n) => ({
          id: n.id,
          ...n,
          time: n.notifyAt,
          createdAt: n.createdAt || new Date().toISOString(),
        }))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

      callback(localNotifications)

      // Set up a periodic check for new local notifications
      const intervalId = setInterval(() => {
        const updatedNotifications = getLocalNotifications()
          .filter((n) => n.user_id === user_id)
          .map((n) => ({
            id: n.id,
            ...n,
            time: n.notifyAt,
            createdAt: n.createdAt || new Date().toISOString(),
          }))
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        callback(updatedNotifications)
      }, 5000)

      return () => clearInterval(intervalId)
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    // Create notifications collection reference
    const notificationsCollection = collection(firestore, "notifications")

    // Create query for user's notifications
    const notificationsQuery = query(notificationsCollection, where("user_id", "==", user_id), limit(20))

    // Subscribe to query
    try {
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notifications: any[] = []
          snapshot.forEach((doc) => {
            const data = doc.data()
            notifications.push({
              id: doc.id,
              ...data,
              time: data.time ? data.time.toDate().toISOString() : new Date().toISOString(),
              createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            })
          })

          // Sort notifications by time (newest first)
          notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

          callback(notifications)
        },
        (error) => {
          console.error("Error in notifications subscription:", error)

          // If there's an error, fall back to local storage
          const localNotifications = getLocalNotifications()
            .filter((n) => n.user_id === user_id)
            .map((n) => ({
              id: n.id,
              ...n,
              time: n.notifyAt,
              createdAt: n.createdAt || new Date().toISOString(),
            }))
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

          callback(localNotifications)
        },
      )

      return unsubscribe
    } catch (error: any) {
      // Check if it's a permissions error
      if (error.message && error.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot subscribe to notifications due to insufficient permissions, using local storage")

        // Fall back to local storage
        const localNotifications = getLocalNotifications()
          .filter((n) => n.user_id === user_id)
          .map((n) => ({
            id: n.id,
            ...n,
            time: n.notifyAt,
            createdAt: n.createdAt || new Date().toISOString(),
          }))
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        callback(localNotifications)

        // Return a no-op function
        return () => {}
      }

      throw error
    }
  } catch (error) {
    console.error("Error setting up notification subscription:", error)
    // Return a no-op function instead of null to avoid type errors
    return () => {}
  }
}

// Get all notifications for a user
export async function getUserNotifications(user_id: string): Promise<any[]> {
  try {
    // In preview environments, use local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for notifications")
      return getLocalNotifications()
        .filter((n) => n.user_id === user_id)
        .map((n) => ({
          id: n.id,
          ...n,
          time: n.notifyAt,
          createdAt: n.createdAt || new Date().toISOString(),
        }))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    try {
      // Create notifications collection reference
      const notificationsCollection = collection(firestore, "notifications")

      // Create query for user's notifications
      const notificationsQuery = query(notificationsCollection, where("user_id", "==", user_id))
      const querySnapshot = await getDocs(notificationsQuery)

      const notifications: any[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        notifications.push({
          id: doc.id,
          ...data,
          time: data.time ? data.time.toDate().toISOString() : new Date().toISOString(),
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        })
      })

      // Sort notifications by time (newest first)
      return notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    } catch (error: any) {
      // Check if it's a permissions error
      if (error.message && error.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot fetch notifications due to insufficient permissions, using local storage")

        // Fall back to local storage
        return getLocalNotifications()
          .filter((n) => n.user_id === user_id)
          .map((n) => ({
            id: n.id,
            ...n,
            time: n.notifyAt,
            createdAt: n.createdAt || new Date().toISOString(),
          }))
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      }

      throw error
    }
  } catch (error) {
    console.error("Error fetching user notifications:", error)
    // Return empty array to prevent UI from breaking
    return []
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    // Check if it's a local notification
    if (notificationId.startsWith("local_")) {
      const notifications = getLocalNotifications()
      const filteredNotifications = notifications.filter((n) => n.id !== notificationId)

      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(filteredNotifications))
      return true
    }

    // In preview environments, skip Firestore operations
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, skipping Firestore notification deletion")
      return true
    }

    const firestore = await getFirestore()
    if (!firestore) {
      throw new Error("Firestore is not initialized")
    }

    try {
      await deleteDoc(doc(firestore, "notifications", notificationId))
      return true
    } catch (error: any) {
      // Check if it's a permissions error
      if (error.message && error.message.includes("Missing or insufficient permissions")) {
        console.warn("Cannot delete notification due to insufficient permissions")
        return false
      }
      throw error
    }
  } catch (error: any) {
    console.error("Error deleting notification:", error)
    return false
  }
}

/**
 * Show a browser notification
 */
export function showBrowserNotification(
  title: string,
  options: NotificationOptions = {},
): globalThis.Notification | null {
  if (!areBrowserNotificationsSupported() || Notification.permission !== "granted") {
    return null
  }

  try {
    return new globalThis.Notification(title, {
      icon: "/favicon.ico",
      ...options,
    })
  } catch (error) {
    console.error("Error showing browser notification:", error)
    return null
  }
}

/**
 * Process due notifications
 */
export async function processDueNotifications(user_id: string): Promise<void> {
  let permissionError = false
  let notifications: TaskNotification[] = []

  try {
    // In preview environments, use local storage
    if (isPreviewEnvironment()) {
      console.log("Preview environment detected, using local storage for notifications")
      const localNotifications = getLocalNotifications()
      const now = new Date()

      notifications = localNotifications.filter(
        (n) => n.user_id === user_id && n.status === "pending" && new Date(n.notifyAt) <= now,
      )
    } else {
      // First try to get notifications from Firestore
      try {
        const firestore = await getFirestore()
        if (!firestore) {
          throw new Error("Firestore not initialized")
        }

        const now = new Date()

        // Get notifications that are due
        const q = query(
          collection(firestore, "notifications"),
          where("user_id", "==", user_id),
          where("status", "==", "pending"),
          where("notifyAt", "<=", now.toISOString()),
        )

        const querySnapshot = await getDocs(q)

        // Convert to array of notifications
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          if (
            !data.user_id ||
            !data.taskId ||
            !data.taskTitle ||
            !data.notificationType ||
            !data.notifyAt ||
            !data.status
          ) {
            console.error("Invalid notification data:", data)
            return
          }

          const notification: TaskNotification = {
            id: doc.id,
            user_id: data.user_id,
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            notificationType: data.notificationType as NotificationType,
            notifyAt: typeof data.notifyAt === "string" ? data.notifyAt : data.notifyAt.toDate().toISOString(),
            status: data.status as NotificationStatus,
          }

          if (data.createdAt) {
            notification.createdAt =
              data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt
          }

          if (data.sentAt) {
            notification.sentAt = data.sentAt instanceof Timestamp ? data.sentAt.toDate().toISOString() : data.sentAt
          }

          if (data.readAt) {
            notification.readAt = data.readAt instanceof Timestamp ? data.readAt.toDate().toISOString() : data.readAt
          }

          notifications.push(notification)
        })
      } catch (firestoreError: any) {
        // Check if it's a permissions error
        if (firestoreError.message && firestoreError.message.includes("Missing or insufficient permissions")) {
          console.warn("Cannot access Firestore notifications due to insufficient permissions, using local storage")
          permissionError = true

          // Fall back to local storage
          const localNotifications = getLocalNotifications()
          const now = new Date()

          notifications = localNotifications.filter(
            (n) => n.user_id === user_id && n.status === "pending" && new Date(n.notifyAt) <= now,
          )
        } else {
          // Rethrow other errors
          throw firestoreError
        }
      }
    }

    // Process notifications
    for (const notification of notifications) {
      // Show browser notification if permission is granted
      if (Notification.permission === "granted") {
        let message = ""
        let icon = "/favicon.ico"

        switch (notification.notificationType) {
          case "reminder":
            message = `Reminder: "${notification.taskTitle}" is scheduled soon`
            icon = "/icons/reminder.png"
            break
          case "due_soon":
            message = `Task "${notification.taskTitle}" is due soon`
            icon = "/icons/due-soon.png"
            break
          case "overdue":
            message = `Task "${notification.taskTitle}" is overdue`
            icon = "/icons/overdue.png"
            break
        }

        showBrowserNotification(message, {
          body: "Click to view task details",
          icon,
        })
      }

      // Mark notification as sent
      try {
        if (notification.id.startsWith("local_")) {
          // Update local storage
          const localNotifications = getLocalNotifications()
          const updatedNotifications = localNotifications.map((n) => {
            if (n.id === notification.id) {
              return {
                ...n,
                status: "sent" as const,
                sentAt: new Date().toISOString(),
              }
            }
            return n
          })

          localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications))
        } else if (!permissionError && !isPreviewEnvironment()) {
          // Update Firestore
          const firestore = await getFirestore()
          await updateDoc(doc(firestore, "notifications", notification.id), {
            status: "sent" as const,
            sentAt: serverTimestamp(),
          })
        }
      } catch (updateError: any) {
        console.error("Error updating notification status:", updateError)

        // Check if it's a permissions error
        if (updateError.message && updateError.message.includes("Missing or insufficient permissions")) {
          console.warn("Cannot update notifications due to insufficient permissions")
          break
        }
      }
    }
  } catch (error: any) {
    console.error("Error processing notifications:", error)

    // Don't rethrow the error to prevent app from crashing
    return
  }
}
