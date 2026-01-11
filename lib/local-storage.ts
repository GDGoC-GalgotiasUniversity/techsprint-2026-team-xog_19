import type { Task } from "@/types/task"

// Function to save a task to local storage
export const saveTaskToLocalStorage = (task: Task): void => {
  try {
    // Get existing tasks
    const existingTasks = getTasksFromLocalStorage()

    // Add new task
    existingTasks.push(task)

    // Save back to local storage
    localStorage.setItem("tasks", JSON.stringify(existingTasks))
  } catch (error) {
    console.error("Error saving task to local storage:", error)
  }
}

// Function to get tasks from local storage
export const getTasksFromLocalStorage = (): Task[] => {
  try {
    const tasksJson = localStorage.getItem("tasks")
    return tasksJson ? JSON.parse(tasksJson) : []
  } catch (error) {
    console.error("Error getting tasks from local storage:", error)
    return []
  }
}

// Function to clear tasks from local storage
export const clearTasksFromLocalStorage = (): void => {
  try {
    localStorage.removeItem("tasks")
  } catch (error) {
    console.error("Error clearing tasks from local storage:", error)
  }
}

// Function to sync local tasks to Firestore
export const syncLocalTasksToFirestore = async (
  addDoc: Function,
  collection: Function,
  db: any,
  user_id: string,
): Promise<void> => {
  try {
    const localTasks = getTasksFromLocalStorage()

    if (localTasks.length === 0) return

    for (const task of localTasks) {
      // Skip tasks that already have an ID (already synced)
      if (task.id && task.id !== "local") continue

      // Add to Firestore
      await addDoc(collection(db, "tasks"), {
        ...task,
        user_id,
      })
    }

    // Clear local storage after successful sync
    clearTasksFromLocalStorage()
  } catch (error) {
    console.error("Error syncing local tasks to Firestore:", error)
  }
}
