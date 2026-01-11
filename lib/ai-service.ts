// AI service for processing chat messages and task management
import { deleteTaskByTitle, completeTaskByTitle, getUserTasks, createTask, getTasksStatistics } from "./task-service"
import type { ChatMessage, Task } from "@/types"

// Define conversation stages
export type ConversationStage =
  | "initialGreeting"
  | "awaitingTaskDetails"
  | "taskUpdate"
  | "decisionMaking"
  | "help"
  | "analytics"
  | "scheduling"

// Define the result type for processChatMessage
export interface ProcessChatMessageResult {
  response: string
  nextConversationStage: ConversationStage
  updatedTaskDetails?: any // Adjust type as needed
}

/**
 * Parse and create multiple tasks from a bulk text input.
 * This is a lightweight fallback that splits the input into lines/segments
 * and attempts to extract task intents for each line. It creates tasks
 * using `createTask` and returns a user-friendly summary.
 */
export async function planBulkTasks(
  bulkText: string,
  user_id: string,
): Promise<ProcessChatMessageResult> {
  const segments = bulkText
    .split(/\r?\n|;|•|\u2022|\-|—/) // split on newlines, semicolons, bullets, dashes
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return {
      response: "I couldn't find any tasks in the input. Please paste each task on a new line or separate with semicolons.",
      nextConversationStage: "initialGreeting",
    }
  }

  const created: string[] = []
  const failed: string[] = []

  for (const seg of segments) {
    try {
      // Try to parse a task-like intent from the line
      const parsed = extractTaskCreationIntent(seg) || { title: seg, duration: 60, priority: "medium", category: "work" }

      // Normalize fields
      const taskToCreate: any = {
        title: parsed.title || seg,
        description: parsed.description || undefined,
        priority: parsed.priority || "medium",
        category: parsed.category || "work",
        duration: parsed.duration || 60,
        deadline: parsed.deadline,
        scheduledTime: parsed.scheduledTime,
        complexity: parsed.complexity || "medium",
      }

      await createTask(taskToCreate, user_id)
      created.push(taskToCreate.title)
    } catch (e: any) {
      console.warn("Failed to create task for segment:", seg, e)
      failed.push(seg)
    }
  }

  let response = "I've processed your list."
  if (created.length > 0) response = `Created ${created.length} task${created.length > 1 ? "s" : ""}: ${created.slice(0, 8).join(", ")}${created.length > 8 ? ", ..." : ""}.`
  if (failed.length > 0) response += `\n\nI couldn't parse or create the following items: ${failed.slice(0, 8).join(", ")}${failed.length > 8 ? ", ..." : ""}.`
  response += "\n\nYou can generate a schedule from the Schedule page or ask me to optimize your plan."

  return {
    response,
    nextConversationStage: "initialGreeting",
  }
}

// System prompt for the AI assistant
const SYSTEM_PROMPT = `
You are an AI assistant for a secure, intelligent task management platform. Your role is to help the current user manage their personal tasks, schedule, and productivity in a safe and ethical way.

⚠️ IMPORTANT RULES (DO NOT BREAK):

1. You are only allowed to reference the tasks, data, and schedule **belonging to the currently authenticated user**. Do not reference or speculate about data from other users.
2. You must NEVER reveal, discuss, or hint at any internal backend information, such as:
  - API endpoints
  - Server structure
  - Authentication methods
  - Database layout
  - Source code
  - API keys or tokens
3. If a request violates privacy, security, or ethical guidelines, politely refuse with a safe, helpful message.
4. NEVER allow or suggest actions that may cause harm, mislead users, or interfere with other users' data or experience.

✅ WHAT YOU CAN DO:
- Help the current user create, update, or reschedule tasks (within their own account).
- Provide task summaries or daily/weekly schedules based on provided data.
- Make smart suggestions (e.g., best time to do a task, flag overloaded schedules).
- Explain scheduling decisions or priorities when asked.
- Answer questions about how the app works, how to use features, and best practices.
- Recommend productivity tips or time-management advice.
- Help users make decisions by weighing pros and cons.
- Provide analytics and insights about task completion patterns.
`

// Function to extract task creation intent from user message
export function extractTaskCreationIntent(message: string): Partial<Task> | null {
  const taskRegex = /add|create|schedule|new task|make a task/i

  if (!taskRegex.test(message)) return null

  let title = ""
  const titleMatch = message.match(/(?:for|to|about) ([^,.]+)/i)
  if (titleMatch) title = titleMatch[1].trim()

  let priority = "medium"
  if (/high priority|urgent|important/i.test(message)) priority = "high"
  if (/low priority|not urgent|not important/i.test(message)) priority = "low"

  let category = "work"
  if (/personal|home|family/i.test(message)) category = "personal"
  if (/study|learn|education|school/i.test(message)) category = "study"
  if (/health|exercise|workout|fitness/i.test(message)) category = "health"

  let duration: number | undefined = 60 // Default to 60 minutes
  const durationMatch = message.match(/(\d+)\s*(?:min|minute|hour)/i)
  if (durationMatch) {
    const value = Number.parseInt(durationMatch[1])
    if (durationMatch[0].includes("hour")) {
      duration = value * 60
    } else {
      duration = value
    }
  }

  let deadline: string | undefined
  let scheduledTime: string | undefined

  const tomorrowRegex = /tomorrow/i
  const todayRegex = /today/i

  if (tomorrowRegex.test(message)) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    deadline = tomorrow.toISOString()
  } else if (todayRegex.test(message)) {
    deadline = new Date().toISOString()
  }

  const timeRegex = /at\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
  const timeMatch = message.match(timeRegex)

  if (timeMatch) {
    const timeStr = timeMatch[1]
    const period = timeMatch[2]?.toLowerCase() || ""

    let hours = 0
    let minutes = 0

    if (timeStr.includes(":")) {
      const [h, m] = timeStr.split(":")
      hours = Number.parseInt(h)
      minutes = Number.parseInt(m)
    } else {
      hours = Number.parseInt(timeStr)
    }

    if (period === "pm" && hours < 12) hours += 12
    if (period === "am" && hours === 12) hours = 0

    const scheduleDate = new Date(deadline || new Date())
    scheduleDate.setHours(hours, minutes, 0, 0)
    scheduledTime = scheduleDate.toISOString()
  }

  // Create a task object with all fields having valid values (not undefined)
  return {
    title: title || "New Task",
    priority,
    category,
    duration,
    deadline,
    scheduledTime,
    complexity: "medium", // Default complexity
  }
}

// Extract task deletion intent
export function extractDeleteIntent(msg: string): string | null {
  const patterns = [
    /(?:delete|remove|cancel)\s+(?:the\s+task\s+)?["']?([^"']+)["']?/i,
    /(?:discard|trash)\s+["']?([^"']+)["']?/i,
  ]
  for (const re of patterns) {
    const m = msg.match(re)
    if (m) return m[1].trim().toLowerCase()
  }
  return null
}

export function extractCompletionIntent(msg: string): string | null {
  const patterns = [
    /(?:mark|set)\s+(?:the\s+task\s+)?["']?(.+?)["']?\s+as\s+(?:done|complete|completed)/i,
    /i\s+(?:finished|completed)\s+["']?(.+?)["']?/i,
    /["']?(.+?)["']?\s+(?:is\s+)?(?:done|complete|completed)/i,
  ]
  for (const re of patterns) {
    const m = msg.match(re)
    if (m) return m[1].trim().toLowerCase()
  }
  return null
}

// Extract analytics intent
export function extractAnalyticsIntent(msg: string): boolean {
  const analyticsPatterns = [
    /show\s+(?:me\s+)?(?:my\s+)?(?:task\s+)?(?:analytics|statistics|stats|progress|performance)/i,
    /how\s+(?:am\s+)?i\s+doing/i,
    /what\s+(?:is|are)\s+my\s+(?:task\s+)?(?:analytics|statistics|stats|progress|performance)/i,
    /(?:analytics|statistics|stats|progress|performance)\s+(?:report|summary)/i,
  ]

  return analyticsPatterns.some((pattern) => pattern.test(msg))
}

// Extract decision-making intent
export function extractDecisionIntent(msg: string): string | null {
  const decisionPatterns = [
    /(?:help|assist)(?:\s+me)?\s+(?:make|with|decide|choosing|choose)\s+(?:a|the)?\s+(?:decision|choice)\s+(?:about|on|between)?\s+(.+)/i,
    /(?:should\s+i|what\s+should\s+i|which\s+should\s+i)\s+(.+)/i,
    /(?:compare|pros\s+and\s+cons|weigh)\s+(.+)/i,
    /(?:i'm|i am)\s+(?:trying\s+to|attempting\s+to)?\s+(?:decide|choose)\s+(?:between|about)\s+(.+)/i,
  ]

  for (const pattern of decisionPatterns) {
    const match = msg.match(pattern)
    if (match) return match[1].trim()
  }

  return null
}

// Extract scheduling intent
export function extractSchedulingIntent(msg: string): boolean {
  const schedulingPatterns = [
    /(?:optimize|schedule|plan|arrange|organize)\s+(?:my\s+)?(?:tasks|schedule|day|week)/i,
    /(?:what|when)\s+should\s+i\s+(?:do|work\s+on)\s+(?:next|today|tomorrow|this\s+week)/i,
    /(?:help|assist)(?:\s+me)?\s+(?:with|plan|organize)\s+(?:my\s+)?(?:schedule|day|tasks)/i,
    /(?:best|optimal)\s+(?:time|schedule|plan)/i,
  ]

  return schedulingPatterns.some((pattern) => pattern.test(msg))
}

// Extract task listing intent
export function extractTaskListIntent(msg: string): string | null {
  const listPatterns = [
    /(?:show|list|display|what\s+are)\s+(?:me\s+)?(?:my\s+)?(?:all\s+)?(?:tasks|to-dos|to\s+dos)/i,
    /(?:show|list|display|what\s+are)\s+(?:me\s+)?(?:my\s+)?(pending|completed|high\s+priority|medium\s+priority|low\s+priority|work|personal|study|health)\s+(?:tasks|to-dos|to\s+dos)/i,
    /(?:what|which)\s+(?:tasks|to-dos|to\s+dos)\s+(?:do\s+i|have\s+i)\s+(?:got|have)/i,
  ]

  for (const pattern of listPatterns) {
    const match = msg.match(pattern)
    if (match) {
      // If there's a specific category/status mentioned, return it
      if (match[1]) return match[1].toLowerCase()
      // Otherwise return "all" to indicate all tasks
      return "all"
    }
  }

  return null
}

// Extract help intent
export function extractHelpIntent(msg: string): boolean {
  const helpPatterns = [
    /(?:help|assist)(?:\s+me)?/i,
    /(?:how\s+(?:do|can)\s+i|what\s+can\s+(?:you|i))\s+(?:do|use)/i,
    /(?:show|tell)(?:\s+me)?\s+(?:how\s+to|what\s+you\s+can\s+do)/i,
    /(?:i\s+need|i\s+want)\s+(?:help|assistance)/i,
    /(?:what\s+are\s+your|your)\s+(?:features|capabilities|functions)/i,
  ]

  return helpPatterns.some((pattern) => pattern.test(msg))
}

// Generate productivity tips
function generateProductivityTip(): string {
  const tips = [
    "Try the Pomodoro Technique: work for 25 minutes, then take a 5-minute break. After 4 cycles, take a longer break.",
    "Use the 2-minute rule: if a task takes less than 2 minutes, do it immediately rather than scheduling it for later.",
    "Plan your most challenging tasks during your peak energy hours when you're most alert and focused.",
    "Group similar tasks together to minimize context switching, which can drain your mental energy.",
    "Start your day by completing one important task before checking emails or messages.",
    "Use time blocking in your calendar to dedicate specific periods for focused work without interruptions.",
    "Try the Eisenhower Matrix: categorize tasks by urgency and importance to prioritize effectively.",
    "Set specific, measurable goals for each work session to maintain focus and track progress.",
    "Take regular breaks to prevent burnout and maintain productivity throughout the day.",
    "Limit multitasking, as it can reduce productivity by up to 40% according to research.",
    "Create a dedicated workspace that signals to your brain it's time to focus.",
    "Use the 'touch it once' principle: when you start something, commit to completing it before moving on.",
    "Schedule buffer time between tasks to account for unexpected delays or overruns.",
    "Try 'eating the frog' - tackling your most difficult or unpleasant task first thing in the morning.",
    "Use the 5-second rule: count down from 5 when you need to start a task you're procrastinating on.",
    "Implement a weekly review to reflect on your accomplishments and plan for the upcoming week.",
    "Use the 80/20 rule (Pareto Principle): focus on the 20% of tasks that will yield 80% of results.",
    "Practice mindfulness or meditation to improve focus and reduce stress.",
    "Use the 'one task' approach: focus completely on one task without switching until it's done.",
    "Set artificial deadlines for open-ended tasks to prevent them from expanding to fill available time.",
  ]

  return tips[Math.floor(Math.random() * tips.length)]
}

// Format task list for display in chat
function formatTaskList(tasks: Task[], filter = "all"): string {
  if (tasks.length === 0) {
    return "You don't have any tasks yet. Would you like me to help you create one?"
  }

  // Filter tasks based on the filter parameter
  let filteredTasks = tasks
  if (filter !== "all") {
    if (filter === "pending" || filter === "completed") {
      filteredTasks = tasks.filter((task) => task.status === filter)
    } else if (filter === "high" || filter === "medium" || filter === "low") {
      filteredTasks = tasks.filter((task) => task.priority === filter)
    } else if (["work", "personal", "study", "health"].includes(filter)) {
      filteredTasks = tasks.filter((task) => task.category === filter)
    }
  }

  if (filteredTasks.length === 0) {
    return `You don't have any ${filter} tasks at the moment.`
  }

  // Sort tasks: pending first, then by priority (high to low)
  filteredTasks.sort((a, b) => {
    // First sort by status (pending before completed)
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1
    }

    // Then sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return (
      priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
    )
  })

  // Format the task list
  let result = `Here are your ${filter !== "all" ? filter + " " : ""}tasks:\n\n`

  filteredTasks.forEach((task, index) => {
    const status = task.status === "completed" ? "✓" : "○"
    const priority = task.priority === "high" ? "⚠️" : task.priority === "medium" ? "⚡" : "🔽"

    result += `${index + 1}. ${status} ${priority} **${task.title}**`

    if (task.description) {
      result += `: ${task.description}`
    }

    if (task.deadline) {
      result += ` (Due: ${new Date(task.deadline).toLocaleDateString()})`
    }

    if (task.scheduledTime) {
      result += ` (Scheduled: ${new Date(task.scheduledTime).toLocaleString()})`
    }

    result += `\n`
  })

  result += `\nTotal: ${filteredTasks.length} task${filteredTasks.length !== 1 ? "s" : ""}`

  return result
}

// Format analytics data for display in chat
async function formatAnalytics(stats: any): Promise<string> {
  const { total, completed, pending, overdue, categoryBreakdown, priorityBreakdown } = stats

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  let result = `📊 **Task Analytics Summary**\n\n`

  result += `**Overall Stats:**\n`
  result += `- Total Tasks: ${total}\n`
  result += `- Completed: ${completed} (${completionRate}%)\n`
  result += `- Pending: ${pending}\n`
  result += `- Overdue: ${overdue}\n\n`

  result += `**By Priority:**\n`
  result += `- High Priority: ${priorityBreakdown.high || 0}\n`
  result += `- Medium Priority: ${priorityBreakdown.medium || 0}\n`
  result += `- Low Priority: ${priorityBreakdown.low || 0}\n\n`

  result += `**By Category:**\n`
  Object.entries(categoryBreakdown).forEach(([category, count]) => {
    result += `- ${category.charAt(0).toUpperCase() + category.slice(1)}: ${count}\n`
  })

  // Add insights based on the data
  result += `\n**Insights:**\n`

  if (completionRate < 30) {
    result += `- Your task completion rate is quite low. Consider breaking down tasks into smaller, more manageable pieces.\n`
  } else if (completionRate > 80) {
    result += `- Great job! You have an excellent task completion rate.\n`
  }

  if (overdue > 0) {
    result += `- You have ${overdue} overdue task${overdue !== 1 ? "s" : ""}. Consider rescheduling or prioritizing these items.\n`
  }

  if (priorityBreakdown.high > priorityBreakdown.medium + priorityBreakdown.low) {
    result += `- You have many high-priority tasks. This might indicate a need to better distribute priorities.\n`
  }

  // Add a random productivity tip
  result += `\n**Productivity Tip:** ${generateProductivityTip()}`

  return result
}

// Function to provide decision-making assistance
function provideDecisionAssistance(decisionTopic: string): string {
  // Generic decision-making framework
  let response = `I'd be happy to help you make a decision about ${decisionTopic}. Let's approach this systematically:\n\n`

  response += `**Decision Framework:**\n\n`

  response += `1. **Clarify your goals**: What are you trying to achieve with this decision? What matters most to you?\n\n`

  response += `2. **Consider your options**: What alternatives do you have? Try to list all possible choices.\n\n`

  response += `3. **Evaluate pros and cons**: For each option, consider:\n`
  response += `   - Benefits and advantages\n`
  response += `   - Costs and disadvantages\n`
  response += `   - Risks and uncertainties\n`
  response += `   - Time and resource requirements\n\n`

  response += `4. **Check alignment with priorities**: Which option best aligns with your values and long-term goals?\n\n`

  response += `5. **Consider the timeline**: Do you need to decide now, or can you gather more information?\n\n`

  response += `If you'd like to discuss specific options for ${decisionTopic}, please share more details about the choices you're considering, and I can help you analyze them more thoroughly.`

  return response
}

// Function to process chat messages
export async function processChatMessage(
  message: string,
  history: ChatMessage[],
  user_id: string,
  conversationStage: ConversationStage = "initialGreeting",
  taskDetails: any = {},
): Promise<ProcessChatMessageResult> {
  try {
    // Step: Handle Delete and Complete Intents Before Anything Else
    const deleteTarget = extractDeleteIntent(message)
    if (deleteTarget) {
      try {
        await deleteTaskByTitle(deleteTarget, user_id)
        return {
          response: `The task "${deleteTarget}" has been deleted.`,
          nextConversationStage: "initialGreeting",
        }
      } catch (err: any) {
        console.error("Error deleting task:", err)
        // Provide a more user-friendly error message
        const errorMessage =
          err.message && err.message.includes("permission")
            ? "I don't have permission to delete that task. This might be due to running in preview mode."
            : `I couldn't find or delete the task "${deleteTarget}". Please double-check the name.`

        return {
          response: errorMessage,
          nextConversationStage: "initialGreeting",
        }
      }
    }

    const completeTarget = extractCompletionIntent(message)
    if (completeTarget) {
      try {
        await completeTaskByTitle(completeTarget, user_id)
        return {
          response: `Marked "${completeTarget}" as done. Great job completing this task!`,
          nextConversationStage: "initialGreeting",
        }
      } catch (err: any) {
        console.error("Error completing task:", err)
        // Provide a more user-friendly error message
        const errorMessage =
          err.message && err.message.includes("permission")
            ? "I don't have permission to update that task. This might be due to running in preview mode."
            : `I couldn't mark "${completeTarget}" as done. Is the name spelled correctly?`

        return {
          response: errorMessage,
          nextConversationStage: "initialGreeting",
        }
      }
    }

    // Check for task listing intent
    const taskListFilter = extractTaskListIntent(message)
    if (taskListFilter) {
      try {
        const tasks = await getUserTasks(user_id)
        const formattedList = formatTaskList(tasks, taskListFilter)

        return {
          response: formattedList,
          nextConversationStage: "initialGreeting",
        }
      } catch (err: any) {
        console.error("Error fetching tasks:", err)
        return {
          response: "I encountered an error while trying to fetch your tasks. Please try again later.",
          nextConversationStage: "initialGreeting",
        }
      }
    }

    // Check for analytics intent
    if (extractAnalyticsIntent(message)) {
      try {
        const stats = await getTasksStatistics(user_id)
        const analyticsResponse = await formatAnalytics(stats)

        return {
          response: analyticsResponse,
          nextConversationStage: "analytics",
        }
      } catch (err: any) {
        console.error("Error fetching analytics:", err)
        return {
          response: "I encountered an error while trying to analyze your tasks. Please try again later.",
          nextConversationStage: "initialGreeting",
        }
      }
    }

    // Check for decision-making intent
    const decisionTopic = extractDecisionIntent(message)
    if (decisionTopic) {
      const decisionResponse = provideDecisionAssistance(decisionTopic)

      return {
        response: decisionResponse,
        nextConversationStage: "decisionMaking",
      }
    }

    // Check for scheduling intent
    if (extractSchedulingIntent(message)) {
      return {
        response:
          "I can help you optimize your schedule. The best approach is to use the 'Generate Schedule' button on the Schedule page, which will automatically arrange your tasks based on priority, deadlines, and estimated duration. Would you like me to explain more about how task scheduling works?",
        nextConversationStage: "scheduling",
      }
    }

    // Check for help intent
    if (extractHelpIntent(message)) {
      return {
        response:
          "I'm your Unbusy assistant! Here's what I can help you with:\n\n" +
          "**Task Management:**\n" +
          '- Create new tasks (e.g., "Create a task to finish the report")\n' +
          "- Mark tasks as complete (e.g., \"Mark 'finish report' as done\")\n" +
          "- Delete tasks (e.g., \"Delete the task called 'old meeting'\")\n" +
          '- List your tasks (e.g., "Show me my pending tasks" or "List my high priority tasks")\n\n' +
          "**Analytics & Insights:**\n" +
          '- Get task statistics (e.g., "Show me my task analytics")\n' +
          "- View completion rates and patterns\n\n" +
          "**Decision Support:**\n" +
          '- Help with decisions (e.g., "Help me decide between option A and B")\n' +
          "- Provide pros and cons analysis\n\n" +
          "**Productivity Tips:**\n" +
          "- Offer time management advice\n" +
          "- Suggest productivity techniques\n\n" +
          "**Scheduling:**\n" +
          "- Explain scheduling algorithms\n" +
          "- Suggest optimal task arrangements\n\n" +
          "What would you like help with today?",
        nextConversationStage: "help",
      }
    }

    // 🧠 Normal conversation logic continues below
    switch (conversationStage) {
      case "initialGreeting": {
        const taskIntent = extractTaskCreationIntent(message)

        if (taskIntent && taskIntent.title) {
          return {
            response: `I see you want to create a task called "${taskIntent.title}". Can you provide more details or shall I create it with the information I have?`,
            nextConversationStage: "awaitingTaskDetails",
            updatedTaskDetails: taskIntent,
          }
        }

        // If no specific intent is detected, provide a helpful response
        const defaultResponses = [
          "I'm here to help you manage your tasks and boost your productivity. What would you like to know about your schedule?",
          "How can I assist you with your task management today?",
          "I can help you create tasks, view your schedule, or provide productivity tips. What would you like to do?",
          "Is there something specific about your tasks or schedule you'd like to know?",
          "I'm your task management assistant. How can I help you be more productive today?",
        ]

        // Add a productivity tip occasionally
        if (Math.random() < 0.3) {
          const tip = generateProductivityTip()
          return {
            response: `${defaultResponses[Math.floor(Math.random() * defaultResponses.length)]}\n\n**Productivity Tip:** ${tip}`,
            nextConversationStage: "initialGreeting",
          }
        }

        return {
          response: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
          nextConversationStage: "initialGreeting",
        }
      }

      case "awaitingTaskDetails": {
        const taskIntent = extractTaskCreationIntent(message)
        const existingDetails = taskDetails || {}

        // Check if the message contains confirmation keywords
        const confirmationRegex = /\b(yes|yeah|yep|sure|ok|okay|fine|create it|go ahead)\b/i
        const confirmationMatch = message.match(confirmationRegex)

        if (confirmationMatch || (taskIntent && taskIntent.title)) {
          try {
            // If we have new details, merge them with existing ones
            const mergedTaskDetails = {
              ...existingDetails,
              ...(taskIntent || {}),
              title: (taskIntent && taskIntent.title) || existingDetails.title || "New Task",
            }

            // Create the task
            await createTask(mergedTaskDetails, user_id)

            // Prepare a detailed response
            let response = `I've created a new task "${mergedTaskDetails.title}" for you with ${mergedTaskDetails.priority} priority`

            if (mergedTaskDetails.category) {
              response += ` in the ${mergedTaskDetails.category} category`
            }

            response += "."

            if (mergedTaskDetails.scheduledTime) {
              response += ` It's scheduled for ${new Date(mergedTaskDetails.scheduledTime).toLocaleString()}.`
            } else if (mergedTaskDetails.deadline) {
              response += ` The deadline is set to ${new Date(mergedTaskDetails.deadline).toLocaleDateString()}.`
            }

            if (mergedTaskDetails.duration) {
              response += ` The estimated duration is ${mergedTaskDetails.duration} minutes.`
            }

            response += " Is there anything else you'd like to do with your tasks?"

            return {
              response,
              nextConversationStage: "initialGreeting",
              updatedTaskDetails: {},
            }
          } catch (createError: any) {
            console.error("Error creating task from chat:", createError)

            if (createError.message && createError.message.includes("cannot be completed before the deadline")) {
              return {
                response: `I tried to create a task based on your message, but the deadline is too soon for the task duration. ${createError.message}`,
                nextConversationStage: "awaitingTaskDetails",
                updatedTaskDetails: existingDetails,
              }
            }

            return {
              response:
                "I tried to create a task based on your message, but encountered an error. Please try again or create the task manually.",
              nextConversationStage: "awaitingTaskDetails",
              updatedTaskDetails: existingDetails,
            }
          }
        } else {
          // Update task details based on the message
          const updatedDetails = { ...existingDetails }

          // Check for priority information
          if (/high priority|urgent|important/i.test(message)) {
            updatedDetails.priority = "high"
          } else if (/low priority|not urgent|not important/i.test(message)) {
            updatedDetails.priority = "low"
          } else if (/medium priority|normal priority/i.test(message)) {
            updatedDetails.priority = "medium"
          }

          // Check for category information
          if (/personal|home|family/i.test(message)) {
            updatedDetails.category = "personal"
          } else if (/work|job|office|business/i.test(message)) {
            updatedDetails.category = "work"
          } else if (/study|learn|education|school|college|university/i.test(message)) {
            updatedDetails.category = "study"
          } else if (/health|exercise|workout|fitness|gym/i.test(message)) {
            updatedDetails.category = "health"
          }

          // Check for duration information
          const durationMatch = message.match(/(\d+)\s*(?:min|minute|hour)/i)
          if (durationMatch) {
            const value = Number.parseInt(durationMatch[1])
            if (durationMatch[0].includes("hour")) {
              updatedDetails.duration = value * 60
            } else {
              updatedDetails.duration = value
            }
          }

          // Check for deadline information
          if (/tomorrow/i.test(message)) {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            updatedDetails.deadline = tomorrow.toISOString()
          } else if (/today/i.test(message)) {
            updatedDetails.deadline = new Date().toISOString()
          }

          // Check for description information
          const descriptionMatch = message.match(/description(?:\s+is|\s*:)?\s+["']?([^"']+)["']?/i)
          if (descriptionMatch) {
            updatedDetails.description = descriptionMatch[1].trim()
          }

          return {
            response: `I've updated the task details. Here's what I have so far:\n\nTitle: ${updatedDetails.title}\nPriority: ${updatedDetails.priority}\nCategory: ${updatedDetails.category || "Not specified"}\nDuration: ${updatedDetails.duration || "Not specified"} minutes\n${updatedDetails.deadline ? `Deadline: ${new Date(updatedDetails.deadline).toLocaleDateString()}` : "Deadline: Not specified"}\n\nWould you like me to create this task now?`,
            nextConversationStage: "awaitingTaskDetails",
            updatedTaskDetails: updatedDetails,
          }
        }
      }

      case "decisionMaking": {
        // Handle follow-up questions in decision-making mode
        if (/pros|cons|advantages|disadvantages|benefits|drawbacks/i.test(message)) {
          return {
            response:
              "When evaluating options, consider these factors:\n\n" +
              "**Pros/Benefits:**\n" +
              "- Impact on your goals and priorities\n" +
              "- Short and long-term advantages\n" +
              "- Resource efficiency\n" +
              "- Alignment with your values\n\n" +
              "**Cons/Drawbacks:**\n" +
              "- Potential risks and uncertainties\n" +
              "- Opportunity costs\n" +
              "- Implementation challenges\n" +
              "- Time and resource requirements\n\n" +
              "Would you like to discuss a specific option in more detail?",
            nextConversationStage: "decisionMaking",
          }
        } else if (/how|method|approach|framework|process/i.test(message)) {
          return {
            response:
              "Here are some effective decision-making methods:\n\n" +
              "1. **Pros and Cons Analysis**: List the advantages and disadvantages of each option\n\n" +
              "2. **Decision Matrix**: Rate options against weighted criteria\n\n" +
              "3. **WRAP Method**:\n" +
              "   - Widen your options\n" +
              "   - Reality-test your assumptions\n" +
              "   - Attain distance before deciding\n" +
              "   - Prepare to be wrong\n\n" +
              "4. **10/10/10 Rule**: How will you feel about this decision in 10 minutes, 10 months, and 10 years?\n\n" +
              "Which of these approaches would you like to explore further?",
            nextConversationStage: "decisionMaking",
          }
        } else {
          // If it seems like a new topic, return to initial greeting
          return {
            response:
              "I hope that helps with your decision. Is there anything else you'd like to know about decision-making, or would you like help with something else?",
            nextConversationStage: "initialGreeting",
          }
        }
      }

      case "analytics": {
        // Handle follow-up questions in analytics mode
        if (/improve|increase|boost|enhance/i.test(message)) {
          return {
            response:
              "Here are some strategies to improve your task completion rate:\n\n" +
              "1. **Break down large tasks** into smaller, manageable subtasks\n" +
              "2. **Use the 2-minute rule**: If a task takes less than 2 minutes, do it immediately\n\n" +
              "3. **Schedule specific time blocks** for focused work on important tasks\n" +
              "4. **Limit work-in-progress** to reduce context switching\n" +
              "5. **Review and adjust priorities** regularly based on changing circumstances\n" +
              "6. **Track your progress** to maintain motivation\n" +
              "7. **Eliminate or delegate** low-value tasks\n\n" +
              "Would you like more specific advice based on your task patterns?",
            nextConversationStage: "analytics",
          }
        } else if (/pattern|trend|insight/i.test(message)) {
          return {
            response:
              "Based on your task history, here are some patterns to consider:\n\n" +
              "- **Time of day**: Consider when you complete most tasks successfully\n" +
              "- **Task size**: Check if you complete more small tasks than large ones\n" +
              "- **Categories**: Identify which types of tasks you complete most consistently\n" +
              "- **Priority levels**: Analyze if high-priority tasks get completed more often\n" +
              "- **Deadlines**: Determine if tasks with deadlines have higher completion rates\n\n" +
              "Tracking these patterns can help you optimize your productivity approach.",
            nextConversationStage: "analytics",
          }
        } else {
          // If it seems like a new topic, return to initial greeting
          return {
            response:
              "I hope that analytics information was helpful. Is there anything specific about your task patterns you'd like to explore, or would you like help with something else?",
            nextConversationStage: "initialGreeting",
          }
        }
      }

      case "scheduling": {
        // Handle follow-up questions in scheduling mode
        if (/algorithm|how|work/i.test(message)) {
          return {
            response:
              "Our scheduling algorithm works by:\n\n" +
              "1. **Prioritizing tasks** based on importance, deadlines, and dependencies\n" +
              "2. **Considering time constraints** including your available hours and preferred work times\n" +
              "3. **Accounting for task duration** to ensure realistic scheduling\n" +
              "4. **Preventing overloading** by distributing tasks appropriately\n" +
              "5. **Allowing for breaks** to maintain productivity\n\n" +
              "The algorithm aims to create an optimal schedule that maximizes productivity while being realistic about what can be accomplished.",
            nextConversationStage: "scheduling",
          }
        } else if (/optimize|best|efficient|effective/i.test(message)) {
          return {
            response:
              "To get the most out of the scheduling feature:\n\n" +
              "1. **Set accurate durations** for your tasks\n" +
              "2. **Assign realistic priorities** (not everything can be high priority)\n" +
              "3. **Include deadlines** when they exist\n" +
              "4. **Update task status promptly** to keep your schedule current\n" +
              "5. **Review and adjust** the generated schedule as needed\n\n" +
              "Would you like me to explain any of these points in more detail?",
            nextConversationStage: "scheduling",
          }
        } else {
          // If it seems like a new topic, return to initial greeting
          return {
            response:
              "I hope that helps with understanding our scheduling approach. Is there anything else you'd like to know about scheduling, or would you like help with something else?",
            nextConversationStage: "initialGreeting",
          }
        }
      }

      case "help": {
        // If we're in help mode and the user asks about a specific feature
        if (/task|create|add|new/i.test(message)) {
          return {
            response:
              "**Creating Tasks**\n\n" +
              "You can create tasks in several ways:\n\n" +
              '1. **Using the chat**: Just tell me what task you want to create. For example, "Create a task to finish the report by tomorrow"\n\n' +
              '2. **Using the New Task button**: Click the "New Task" button in the header to open the task creation form\n\n' +
              "3. **From the dashboard**: Navigate to the dashboard and use the quick actions\n\n" +
              "When creating a task, you can specify:\n" +
              "- Title (required)\n" +
              "- Description (optional)\n" +
              "- Priority (high, medium, low)\n" +
              "- Category (work, personal, study, health)\n" +
              "- Duration (estimated time to complete)\n" +
              "- Deadline (when it must be done by)\n\n" +
              "Would you like me to help you create a task now?",
            nextConversationStage: "help",
          }
        } else if (/schedule|calendar|plan/i.test(message)) {
          return {
            response:
              "**Scheduling Features**\n\n" +
              "The scheduling system helps you organize your tasks efficiently:\n\n" +
              "1. **Automatic scheduling**: The system can automatically schedule your tasks based on priority, deadlines, and estimated duration\n\n" +
              "2. **Calendar view**: View your scheduled tasks in day, week, or month format\n\n" +
              "3. **Google Calendar integration**: Sync your tasks with Google Calendar (available in deployed environments)\n\n" +
              "4. **Manual adjustments**: You can manually adjust scheduled times as needed\n\n" +
              'To generate a schedule, go to the Schedule page and click the "Generate Schedule" button.\n\n' +
              "Would you like to know more about any specific scheduling feature?",
            nextConversationStage: "help",
          }
        } else if (/analytics|statistics|progress|performance/i.test(message)) {
          return {
            response:
              "**Analytics Features**\n\n" +
              "The analytics system provides insights into your task management:\n\n" +
              "1. **Completion rate**: Track what percentage of tasks you complete\n\n" +
              "2. **Priority breakdown**: See the distribution of high, medium, and low priority tasks\n\n" +
              "3. **Category analysis**: Understand which categories of tasks you have most\n\n" +
              "4. **Overdue tracking**: Monitor tasks that have passed their deadlines\n\n" +
              "5. **Productivity patterns**: Identify your most productive periods\n\n" +
              "To view your analytics, go to the Analytics page or ask me to show your task statistics.\n\n" +
              "Would you like me to show your current analytics?",
            nextConversationStage: "help",
          }
        } else {
          // If it seems like a new topic, return to initial greeting
          return {
            response:
              "I hope that helps! Is there anything specific you'd like to know more about, or would you like help with something else?",
            nextConversationStage: "initialGreeting",
          }
        }
      }

      default: {
        return {
          response:
            "I'm not sure how to handle that request yet. Would you like to create a new task, view your existing tasks, or get some productivity tips?",
          nextConversationStage: "initialGreeting",
          updatedTaskDetails: taskDetails,
        }
      }
    }
  } catch (error) {
    console.error("Error processing chat message:", error)
    return {
      response:
        "I'm sorry, I encountered an error processing your request. Please try again with a different question or task.",
      nextConversationStage: "initialGreeting",
      updatedTaskDetails: taskDetails,
    }
  }
}
