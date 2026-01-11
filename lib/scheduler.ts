import type { Task } from "@/types/task"

/**
 * Schedules tasks optimally based on priorities, deadlines, and dependencies
 * This is a simplified scheduling algorithm for demonstration purposes
 */
export function scheduleTasksOptimally(tasks: Task[]): Task[] {
  if (tasks.length === 0) return []

  // Create a copy of tasks to avoid mutating the original
  const tasksCopy = [...tasks]

  // Sort tasks by priority (high > medium > low) and then by deadline
  tasksCopy.sort((a, b) => {
    // First sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const priorityDiff =
      priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]

    if (priorityDiff !== 0) return priorityDiff

    // Then sort by deadline (if both have deadlines)
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }

    // Tasks with deadlines come before tasks without deadlines
    if (a.deadline) return -1
    if (b.deadline) return 1

    // If no other criteria, sort by duration (shorter tasks first)
    return (a.duration || 0) - (b.duration || 0)
  })

  // Start scheduling from current time
  let currentTime = new Date()

  // Round to the nearest 15 minutes
  currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / 15) * 15)
  currentTime.setSeconds(0)
  currentTime.setMilliseconds(0)

  // Schedule each task
  const scheduledTasks = tasksCopy.map((task) => {
    // Skip already scheduled tasks
    if (task.scheduledTime) {
      return task
    }

    // Set the scheduled time for this task
    const scheduledTime = new Date(currentTime)

    // Check if the task has a deadline and if scheduling would exceed it
    if (task.deadline) {
      const deadlineTime = new Date(task.deadline)
      const taskEndTime = new Date(currentTime.getTime() + (task.duration || 60) * 60 * 1000)

      // If task would end after deadline, try to schedule it earlier if possible
      if (taskEndTime > deadlineTime) {
        // Calculate how much earlier we need to start
        const timeNeeded = (task.duration || 60) * 60 * 1000
        const earlierStart = new Date(deadlineTime.getTime() - timeNeeded)

        // If earlier start is in the future, use it
        if (earlierStart > new Date()) {
          currentTime = earlierStart
        }
        // Otherwise, just schedule it now and accept that it might not meet the deadline
      }
    }

    // Move the current time forward by the task duration
    currentTime = new Date(currentTime.getTime() + (task.duration || 60) * 60 * 1000)

    // Return the task with the scheduled time
    return {
      ...task,
      scheduledTime: scheduledTime.toISOString(),
    }
  })

  return scheduledTasks
}
