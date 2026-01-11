"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
} from "@/lib/firebase"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [resetPasswordMode, setResetPasswordMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // 1) initial auth check & listener (unchanged)
  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => void) | undefined

    const checkAuth = async () => {
      try {
        const auth = await getAuth()
        if (!auth) {
          if (isMounted) {
            setAuthReady(false)
            setAuthLoading(false)
          }
          return
        }
        if (isMounted) setAuthReady(true)

        if (auth.currentUser && isMounted) {
          setUser(auth.currentUser)
          setAuthLoading(false)
          setInitialized(true)
        }

        const { onAuthStateChanged } = await import("firebase/auth")
        unsubscribe = onAuthStateChanged(auth, (u) => {
          if (!isMounted) return
          setUser(u)
          setAuthLoading(false)
          setInitialized(true)
        })
      } catch (err) {
        console.error("Auth check error:", err)
        if (isMounted) {
          setAuthLoading(false)
          setInitialized(true)
        }
      }
    }

    checkAuth()
    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [])

  // 2) handle login click — now does redirect immediately
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!email.trim()) throw new Error("Please enter your email address")
      if (!password.trim()) throw new Error("Please enter your password")

      const auth = await getAuth()
      if (!auth) throw new Error("Authentication service is not available. Please refresh the page.")

      // If already logged in, jump straight to dashboard
      if (auth.currentUser) {
        router.replace("/dashboard")
        return
      }

      // otherwise sign in
      await signInWithEmailAndPassword(email, password)

      toast({
        title: "Login successful",
        description: "Redirecting to dashboard...",
      })

      // immediate redirect
      router.replace("/dashboard")
    } catch (loginError: any) {
      console.error("Login error:", loginError)
      switch (loginError.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("Invalid email or password. Please try again.")
          break
        case "auth/user-disabled":
          setError("This account has been disabled.")
          break
        case "auth/too-many-requests":
          setError("Too many failed login attempts. Please try again later.")
          break
        case "auth/invalid-email":
          setError("Invalid email format.")
          break
        case "auth/network-request-failed":
          setError("Network error. Please check your internet connection.")
          break
        default:
          setError(loginError.message || "An error occurred during login.")
      }
    } finally {
      setLoading(false)
    }
  }

  // 3) other handlers unchanged...
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResetSent(false)

    try {
      if (!email.trim()) throw new Error("Please enter your email address")
      await sendPasswordResetEmail(email)

      setResetSent(true)
      toast({
        title: "Reset email sent",
        description: "Check your email to reset your password.",
      })
    } catch (resetError: any) {
      console.error("Password reset error:", resetError)
      switch (resetError.code) {
        case "auth/user-not-found":
          setResetSent(true)
          break
        case "auth/invalid-email":
          setError("Invalid email format.")
          break
        case "auth/too-many-requests":
          setError("Too many requests. Please try again later.")
          break
        default:
          setError(resetError.message || "Failed to send reset email.")
      }
    } finally {
      setLoading(false)
    }
  }

  const createTestUser = async () => {
    try {
      setLoading(true)
      await createUserWithEmailAndPassword("test@example.com", "password123")
      setEmail("test@example.com")
      setPassword("password123")

      toast({
        title: "Test user created",
        description: "test@example.com / password123",
      })
    } catch (error: any) {
      console.error("Error creating test user:", error)
      if (error.code === "auth/email-already-in-use") {
        setEmail("test@example.com")
        setPassword("password123")
      } else {
        setError(error.message || "Failed to create test user.")
      }
    } finally {
      setLoading(false)
    }
  }

  // 4) rendering logic

  // still show "Initializing…" while authLoading
  if (authLoading && !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-foreground">Initializing authentication...</p>
        </div>
      </div>
    )
  }

  // **NO MORE** `if (user) return <Redirecting…>` block

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-card">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-card-foreground">
            {resetPasswordMode ? "Reset Password" : "Sign in to your account"}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {resetPasswordMode
              ? "Enter your email to receive a password reset link"
              : "Enter your email and password to access your dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetPasswordMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {resetSent && (
                <Alert className="bg-green-900/20 text-green-400 border-green-800/50">
                  <AlertDescription>If an account exists, a reset link will be emailed.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !authReady}
                  placeholder="your@email.com"
                  className="bg-input text-foreground"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !authReady}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-primary"
                onClick={() => setResetPasswordMode(false)}
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !authReady}
                  placeholder="your@email.com"
                  className="bg-input text-foreground"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">
                    Password
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm font-medium text-primary p-0 h-auto"
                    onClick={() => setResetPasswordMode(true)}
                  >
                    Forgot password?
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !authReady}
                  placeholder="••••••••"
                  className="bg-input text-foreground"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !authReady}>
                {loading ? "Signing in..." : !authReady ? "Initializing Auth..." : "Sign in"}
              </Button>
            </form>
          )}

          {process.env.NODE_ENV !== "production" && authReady && !resetPasswordMode && (
            <div className="mt-4">
              <Button type="button" className="w-full" onClick={createTestUser} disabled={loading}>
                Create Test User
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">Dev mode: test@example.com / password123</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-muted-foreground w-full">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
