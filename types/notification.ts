export interface TaskNotification {
  id: string
  user_id: string
  taskId: string
  taskTitle: string
  notificationType: NotificationType
  notifyAt: string
  status: NotificationStatus
  createdAt?: string
  sentAt?: string
  readAt?: string
}

export type NotificationType = "reminder" | "due_soon" | "overdue" | "scheduled"

export type NotificationStatus = "pending" | "sent" | "read"
