// Enhanced ML service with more sophisticated prediction algorithms
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "./firebase"

/**
 * Predicts task duration based on description, priority, and historical data
 * Uses a more sophisticated algorithm that learns from user's past tasks
 */
export async function predictTaskDuration(description: string, priority: string, user_id?: string): Promise<number> {
  const basePrediction = getBasePrediction(description, priority)

  if (user_id) {
    try {
      const historicalData = await getHistoricalTaskData(user_id)
      return refineWithHistoricalData(basePrediction, description, priority, historicalData)
    } catch (error: any) {
      console.error("Error fetching historical data:", error)
      return basePrediction
    }
  }

  return basePrediction
}

function getBasePrediction(description: string, priority: string): number {
  const baseTime = 30
  const words = description.split(/\s+/).filter((word) => word.length > 0)
  const wordCount = words.length

  const complexityIndicators = [
    "analyze", "create", "design", "develop", "implement", "integrate", "research", "review", "test",
    "debug", "optimize", "refactor", "complex", "difficult", "challenging", "comprehensive",
  ]
  const complexityScore = complexityIndicators.reduce((score, indicator) =>
    score + (description.toLowerCase().includes(indicator) ? 1 : 0), 0)

  const lengthFactor = Math.min(wordCount / 10, 5)
  const complexityFactor = Math.min(complexityScore * 0.5, 3)
  const priorityMultiplier = priority === "high" ? 1.5 : priority === "medium" ? 1.0 : 0.7

  const predictedDuration = Math.round(baseTime * (1 + lengthFactor + complexityFactor) * priorityMultiplier)
  return Math.min(Math.max(predictedDuration, 15), 480)
}

async function getHistoricalTaskData(user_id: string) {
  try {
    const firestore = await db.get() // ✅ Correctly await the Firestore instance
    if (!firestore) throw new Error("Firestore is not initialized")

    const tasksRef = collection(firestore, "tasks")
    const q = query(tasksRef, where("user_id", "==", user_id), where("status", "==", "completed"))
    const querySnapshot = await getDocs(q)

    const historicalTasks: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.duration) {
        historicalTasks.push({
          description: data.description || "",
          priority: data.priority || "medium",
          duration: data.duration,
        })
      }
    })

    return historicalTasks
  } catch (error) {
    console.error("Error in getHistoricalTaskData:", error)
    throw error
  }
}

function refineWithHistoricalData(
  basePrediction: number,
  description: string,
  priority: string,
  historicalTasks: any[],
): number {
  if (historicalTasks.length === 0) return basePrediction

  const similarTasks = findSimilarTasks(description, priority, historicalTasks)
  if (similarTasks.length === 0) return basePrediction

  const totalDuration = similarTasks.reduce((sum, task) => sum + task.duration, 0)
  const averageDuration = totalDuration / similarTasks.length

  const blendedPrediction = Math.round(basePrediction * 0.3 + averageDuration * 0.7)
  return Math.min(Math.max(blendedPrediction, 15), 480)
}

function findSimilarTasks(description: string, priority: string, historicalTasks: any[]): any[] {
  const lowerDescription = description.toLowerCase()
  const keywords = lowerDescription
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !["and", "the", "this", "that", "with", "from"].includes(word))

  const scoredTasks = historicalTasks.map((task) => {
    const lowerTaskDesc = task.description.toLowerCase()
    const keywordScore = keywords.reduce((score, keyword) =>
      score + (lowerTaskDesc.includes(keyword) ? 1 : 0), 0)
    const priorityScore = task.priority === priority ? 2 : 0
    const totalScore = keywordScore + priorityScore

    return {
      ...task,
      similarityScore: totalScore,
    }
  })

  scoredTasks.sort((a, b) => b.similarityScore - a.similarityScore)
  return scoredTasks.filter((task) => task.similarityScore > 1).slice(0, 5)
}

export async function predictTaskComplexity(description: string, user_id?: string): Promise<string> {
  const baseComplexity = getBaseComplexity(description)

  if (user_id) {
    try {
      const historicalData = await getHistoricalTaskData(user_id)
      return refineComplexityWithHistoricalData(baseComplexity, description, historicalData)
    } catch (error) {
      console.error("Error fetching historical data for complexity:", error)
      return baseComplexity
    }
  }

  return baseComplexity
}

function getBaseComplexity(description: string): string {
  const complexityKeywords = {
    high: ["complex", "difficult", "challenging", "analyze", "research", "develop", "design", "implement", "integrate", "optimize", "architecture", "framework", "system", "algorithm"],
    medium: ["create", "build", "modify", "update", "enhance", "improve", "feature", "function", "component", "module", "test"],
    low: ["simple", "easy", "quick", "small", "minor", "fix", "update", "change", "add", "remove", "edit", "check"],
  }

  const scores = { high: 0, medium: 0, low: 0 }
  const lowerDesc = description.toLowerCase()

  for (const [level, keywords] of Object.entries(complexityKeywords)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        scores[level as keyof typeof scores] += 1
      }
    }
  }

  const weightedScores = {
    high: scores.high * 3,
    medium: scores.medium * 2,
    low: scores.low * 1,
  }

  if (weightedScores.high > weightedScores.medium && weightedScores.high > weightedScores.low) {
    return "high"
  } else if (weightedScores.medium > weightedScores.low) {
    return "medium"
  } else {
    return "low"
  }
}

function refineComplexityWithHistoricalData(
  baseComplexity: string,
  description: string,
  historicalTasks: any[],
): string {
  return baseComplexity
}
