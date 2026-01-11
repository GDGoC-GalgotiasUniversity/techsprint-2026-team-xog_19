// Export all types from the various type files
export * from "./task"
export * from "./notification"

// Define ChatMessage type
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
