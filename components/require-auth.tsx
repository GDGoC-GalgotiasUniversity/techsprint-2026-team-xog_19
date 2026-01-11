"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "../hooks/use-auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showError, setShowError] = useState(false)
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    let redirectTimer: NodeJS.Timeout

    // Only redirect if not loading, not authenticated, and Firebase is ready or errored
    if (!loading && !user && !redirected) {
      console.log("RequireAuth: No user detected, redirecting to login")

      // Set a short delay before redirecting to avoid potential race conditions
      redirectTimer = setTimeout(() => {
        // Redirect to /login (you have a /login route, not /signup)
        if (pathname !== "/login" && pathname !== "/signup") {
          setRedirected(true) // Prevent multiple redirects
          router.push("/login")
        }
      }, 100)
    }

    // Show error after a delay if there's an error
    let errorTimer: NodeJS.Timeout
    if (error && !showError) {
      errorTimer = setTimeout(() => {
        setShowError(true)
      }, 3000)
    }

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer)
      if (errorTimer) clearTimeout(errorTimer)
    }
  }, [user, loading, router, error, showError, pathname, redirected])

  // Add a recovery mechanism for auth errors
  useEffect(() => {
    let recoveryTimer: NodeJS.Timeout

    // If there's an auth error, try to recover after some time
    if (error && showError) {
      recoveryTimer = setTimeout(() => {
        window.location.reload() // Force reload the page to reinitialize auth
      }, 10000) // Wait 10 seconds before forcing reload
    }

    return () => {
      if (recoveryTimer) clearTimeout(recoveryTimer)
    }
  }, [error, showError])

  // While loading authentication, show a loading spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show an error if there's an error
  if (error && showError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Authentication error: {error.message}</AlertDescription>
          </Alert>
          <p className="text-center text-muted-foreground">Please refresh the page or try again later.</p>
        </div>
      </div>
    )
  }

  // If no user, don't render anything (because we already pushed to login)
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If authenticated, render the protected page
  return <>{children}</>
}
