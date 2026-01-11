"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Check } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { getFirestore } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"

export default function EmailNotificationSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Notification settings
  const [taskReminders, setTaskReminders] = useState(true)
  const [deadlineAlerts, setDeadlineAlerts] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [systemUpdates, setSystemUpdates] = useState(true)

  // Load user's notification settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const firestore = await getFirestore()
        if (!firestore) {
          throw new Error("Firestore is not initialized")
        }

        const docRef = doc(firestore, "users", user.uid, "settings", "emailNotifications")
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          setTaskReminders(data.taskReminders ?? true)
          setDeadlineAlerts(data.deadlineAlerts ?? true)
          setWeeklyDigest(data.weeklyDigest ?? false)
          setSystemUpdates(data.systemUpdates ?? true)
        }
      } catch (error: any) {
        console.error("Error loading notification settings:", error)
        setError("Failed to load notification settings")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [user])

  const handleSaveSettings = async () => {
    if (!user) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const firestore = await getFirestore()
      if (!firestore) {
        throw new Error("Firestore is not initialized")
      }

      // Save settings to Firestore
      await setDoc(doc(firestore, "users", user.uid, "settings", "emailNotifications"), {
        taskReminders,
        deadlineAlerts,
        weeklyDigest,
        systemUpdates,
        updatedAt: new Date().toISOString(),
      })

      setSuccess(true)
      toast({
        title: "Settings saved",
        description: "Your email notification settings have been updated.",
      })
    } catch (error: any) {
      console.error("Error saving notification settings:", error)
      setError(error.message || "Failed to save notification settings")

      toast({
        title: "Save failed",
        description: error.message || "Failed to save notification settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notification Settings</CardTitle>
        <CardDescription>Manage how you receive email notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>Settings saved successfully!</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="task-reminders" className="font-medium">
                Task Reminders
              </Label>
              <p className="text-sm text-muted-foreground">Receive emails about upcoming tasks</p>
            </div>
            <Switch
              id="task-reminders"
              checked={taskReminders}
              onCheckedChange={setTaskReminders}
              disabled={loading || saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="deadline-alerts" className="font-medium">
                Deadline Alerts
              </Label>
              <p className="text-sm text-muted-foreground">Get notified when task deadlines are approaching</p>
            </div>
            <Switch
              id="deadline-alerts"
              checked={deadlineAlerts}
              onCheckedChange={setDeadlineAlerts}
              disabled={loading || saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="weekly-digest" className="font-medium">
                Weekly Digest
              </Label>
              <p className="text-sm text-muted-foreground">Receive a weekly summary of your tasks and progress</p>
            </div>
            <Switch
              id="weekly-digest"
              checked={weeklyDigest}
              onCheckedChange={setWeeklyDigest}
              disabled={loading || saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="system-updates" className="font-medium">
                System Updates
              </Label>
              <p className="text-sm text-muted-foreground">Get notified about new features and updates</p>
            </div>
            <Switch
              id="system-updates"
              checked={systemUpdates}
              onCheckedChange={setSystemUpdates}
              disabled={loading || saving}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveSettings} disabled={loading || saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  )
}
