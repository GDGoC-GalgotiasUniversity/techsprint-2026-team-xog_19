"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged, type User } from "firebase/auth"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import DashboardHeader from "@/components/dashboard-header"
import { predictTaskDuration, predictTaskComplexity } from "@/lib/ml-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ShieldAlert } from "lucide-react"
import type { Task } from "@/types"
import ChatInterface from "@/components/ai-chat/chat-interface"
import { createTask } from "@/lib/task-service"

export default function NewTaskPage() {
  const router = useRouter()
  const { toast } = useToast()

  // ── AUTH STATE ────────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  // ── TASK STATE ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [duration, setDuration] = useState("")
  const [deadline, setDeadline] = useState("")
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null)
  const [complexity, setComplexity] = useState<string | null>(null)
  const [predicting, setPredicting] = useState(false)
  const [mlError, setMlError] = useState<string | null>(null)
  const [category, setCategory] = useState("work")
  const [deadlineError, setDeadlineError] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState(false)

  // ── AUTH CHECK ────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
      } else {
        router.replace("/login")
      }
      setAuthChecked(true)
    })
    return () => unsub()
  }, [router])

  // ── DEADLINE VALIDATION ────────────────────────────────────────────────────
  const validateDeadline = () => {
    if (!deadline || !duration) {
      setDeadlineError(null)
      return true
    }
    const now = Date.now()
    const dl = new Date(deadline).getTime()
    const need = Number.parseInt(duration, 10) * 60 * 1000
    if (now + need > dl) {
      const minsLeft = Math.floor((dl - now) / (60 * 1000))
      setDeadlineError(`This task requires ${duration} min but only ${minsLeft} min remain before the deadline.`)
      return false
    }
    setDeadlineError(null)
    return true
  }

  useEffect(() => {
    validateDeadline()
  }, [duration, deadline])

  // ── FORM SUBMISSION ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!validateDeadline()) {
      toast({
        title: "Invalid deadline",
        description: deadlineError!,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // prepare finalDuration
      let finalDuration = Number.parseInt(duration) || 0
      if (!finalDuration && description) {
        try {
          finalDuration = await predictTaskDuration(description, priority, user.uid)
        } catch {
          finalDuration = 60
        }
      }
      // complexity
      let finalComplexity = complexity
      if (!finalComplexity && description) {
        try {
          finalComplexity = await predictTaskComplexity(description)
        } catch {
          finalComplexity = "medium"
        }
      }
      // build task
      const taskData: Partial<Task> = {
        title,
        description,
        priority,
        category,
        complexity: finalComplexity || "medium",
        duration: finalDuration || 60,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        status: "pending",
        user_id: user.uid,
      }
      // save
      const id = await createTask(taskData, user.uid)
      toast({ title: "Task created", description: "Your task has been created." })
      setPermissionError(false)
      router.push("/schedule")
    } catch (e: any) {
      console.error(e)
      if (e.message.includes("permission")) {
        setPermissionError(true)
        toast({
          title: "Permission Error",
          description: "You don't have permission to create tasks.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Failed to create task",
          description: e.message,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDescriptionChange = async (val: string) => {
    setDescription(val)
    setMlError(null)

    if (!user) return

    if (val.length > 10 && !duration) {
      setPredicting(true)
      try {
        const pd = await predictTaskDuration(val, priority, user.uid)
        setEstimatedDuration(pd)
        const pc = await predictTaskComplexity(val)
        setComplexity(pc)
      } catch (err: any) {
        if (err.message.includes("permission")) {
          setMlError("Insufficient permissions for ML predictions.")
        }
      } finally {
        setPredicting(false)
      }
    }
  }

  // ── RENDER UI ───────────────────���────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6">
        {!authChecked ? (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-foreground">Checking authentication…</p>
            </div>
          </div>
        ) : !user ? null : (
          <>
            {permissionError && (
              <Alert variant="destructive" className="mb-6">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Firestore Permission Error</AlertTitle>
                <AlertDescription>
                  You don't have permission to create tasks. Tasks will be local only.
                </AlertDescription>
              </Alert>
            )}

            <Card className="mx-auto max-w-2xl border-border bg-card">
              <CardHeader>
                <CardTitle>Create New Task</CardTitle>
                <CardDescription>
                  {permissionError ? "Saving locally only." : "Add a new task to your schedule."}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {mlError && (
                    <Alert variant="warning">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{mlError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="bg-secondary border-border"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      rows={4}
                      className="bg-secondary border-border"
                    />
                    {predicting && <p className="text-sm text-muted-foreground">Analyzing…</p>}
                    {complexity && !predicting && !mlError && (
                      <div className="mt-1 text-sm">
                        Predicted complexity:{" "}
                        <span
                          className={
                            complexity === "high"
                              ? "text-red-500"
                              : complexity === "medium"
                                ? "text-yellow-500"
                                : "text-green-500"
                          }
                        >
                          {complexity}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v)}>
                        <SelectTrigger id="priority" className="bg-secondary border-border">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={category} onValueChange={(v) => setCategory(v)}>
                        <SelectTrigger id="category" className="bg-secondary border-border">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="study">Study</SelectItem>
                          <SelectItem value="health">Health</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="duration">
                        Duration (min)
                        {estimatedDuration && !duration && !mlError && (
                          <span className="ml-2 text-sm text-muted-foreground">(Est: {estimatedDuration} min)</span>
                        )}
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        min="1"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="bg-secondary border-border"
                      />
                      {deadlineError && <p className="text-sm text-red-500 mt-1">{deadlineError}</p>}
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    type="submit"
                    disabled={loading || !!deadlineError}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loading ? "Creating..." : "Create Task"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </>
        )}
      </main>
      <ChatInterface />
    </div>
  )
}
