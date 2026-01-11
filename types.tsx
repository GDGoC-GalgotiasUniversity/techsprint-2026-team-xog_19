export interface Task {
  id: string
  title: string
  description?: string
  duration?: number
  priority: string
  complexity?: string
  deadline?: string
  dependencies?: string[]
  user_id: string
  status: "pending" | "completed"
  scheduledTime?: string
  createdAt?: any
  calendarEventId?: string
  calendarId?: string
  category?: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
