"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart2, Calendar, Home, LogOut, Settings, PlusCircle } from "lucide-react"
import { useState } from "react"
import { getAuth, signOut } from "firebase/auth"
import NotificationCenter from "@/components/notification-center"

export default function DashboardHeader() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      const auth = getAuth()
      await signOut(auth)

      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })

      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout failed",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="container flex h-16 items-center px-4">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">Unbusy</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-2 ml-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <Home className="mr-2 h-4 w-4" /> Home
              </Button>
            </Link>
            <Link href="/schedule">
              <Button variant="ghost" size="sm">
                <Calendar className="mr-2 h-4 w-4" /> Schedule
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="ghost" size="sm">
                <BarChart2 className="mr-2 h-4 w-4" /> Analytics
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          {user && (
            <>
              <Link href="/tasks/new">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> New Task
                </Button>
              </Link>

              <NotificationCenter />

              <span className="text-sm hidden md:inline">{user.email}</span>

              <Button variant="destructive" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
