// app/settings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged, type User } from "firebase/auth"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import DashboardHeader from "@/components/dashboard-header"
import ChatInterface from "@/components/ai-chat/chat-interface"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

import CalendarIntegration from "@/components/calendar-integration"
import { updateUserProfile } from "@/lib/firebase"
import PasswordChangeForm from "@/components/password-change-form"
import EmailNotificationSettings from "@/components/email-notification-settings"

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()

  // ── AUTH STATE ─────────────────────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)

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

  // ── PROFILE STATE ──────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("profile")

  useEffect(() => {
    if (user) setDisplayName(user.displayName || "")
  }, [user])

  const handleUpdateProfile = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      await updateUserProfile({ displayName })
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." })
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Failed to update profile")
      toast({
        title: "Update failed",
        description: e.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="calendar">Calendar Integration</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* ── PROFILE TAB ── */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Manage your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading || !displayName}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* ── SECURITY TAB ── */}
          <TabsContent value="security">
            <div className="space-y-6">
              <PasswordChangeForm />
            </div>
          </TabsContent>

          {/* ── CALENDAR TAB ── */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Google Calendar Integration</CardTitle>
                <CardDescription>
                  Connect your Google Calendar to sync tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CalendarIntegration />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── NOTIFICATIONS TAB ── */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              <EmailNotificationSettings />
              <Card>
                <CardHeader>
                  <CardTitle>Browser Notification Settings</CardTitle>
                  <CardDescription>
                    Manage how you receive browser notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="browser-notifications" defaultChecked />
                    <Label htmlFor="browser-notifications">
                      Browser notifications
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="task-reminders" defaultChecked />
                    <Label htmlFor="task-reminders">Task reminders</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="deadline-alerts" defaultChecked />
                    <Label htmlFor="deadline-alerts">Deadline alerts</Label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button>Save Notification Settings</Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <ChatInterface />
    </div>
  )
}
