"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/hooks/use-auth"
import { getUserNotifications, markNotificationAsRead } from "@/lib/notification-service"

interface NotificationCenterProps {
  onError?: (error: Error) => void
}

export default function NotificationCenter({ onError }: NotificationCenterProps) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch notifications when user changes or popover opens
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return

      try {
        setLoading(true)
        const userNotifications = await getUserNotifications(user.uid)
        setNotifications(userNotifications)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching notifications:", err)
        setError(err.message || "Failed to load notifications")
        if (onError) onError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }

    if (user && open) {
      fetchNotifications()
    }
  }, [user, open, onError])

  // Calculate unread count
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length)
  }, [notifications])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Update local state immediately for better UX
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))

      // Call API to mark as read
      if (user) {
        await markNotificationAsRead(notificationId)
      }
    } catch (error: any) {
      console.error("Error marking notification as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      // Update local state immediately
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

      // Call API to mark all as read
      if (user) {
        const markPromises = notifications.filter((n) => !n.read).map((n) => markNotificationAsRead(n.id))

        await Promise.all(markPromises)
      }
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b last:border-0 ${!notification.read ? "bg-muted/50" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-medium">{notification.title}</h4>
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                    Dismiss
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(notification.time).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
