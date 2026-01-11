"use client"

import { createContext, useState, useEffect, useRef, useContext, type ReactNode } from "react"
import { onAuthStateChanged } from "../lib/firebase"
import type { User } from "firebase/auth"
import LoadingScreen from "./loading-screen"

export interface AuthContextType {
  user: User | null
  loading: boolean
  error: Error | null
  authInitialized: boolean
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  authInitialized: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    console.log("AuthProvider: Mounting and setting up listener.")

    // Set a timeout to ensure we don't hang indefinitely
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !authInitialized) {
        console.warn("AuthProvider: Auth initialization timed out")
        setLoading(false)
        setAuthInitialized(true)
        setError(new Error("Authentication initialization timed out"))
      }
    }, 10000) // 10 second timeout

    const setupAuthListener = async () => {
      try {
        console.log("AuthProvider: Setting up auth state listener...")

        const unsubscribe = await onAuthStateChanged((authUser) => {
          if (!isMountedRef.current) {
            console.log("AuthProvider: Auth state changed but component unmounted.")
            return
          }

          console.log("AuthProvider: onAuthStateChanged triggered. User:", authUser ? authUser.uid : "null")
          setUser(authUser)
          setError(null)
          setLoading(false)
          setAuthInitialized(true)
        })

        if (unsubscribe && isMountedRef.current) {
          console.log("AuthProvider: Listener subscribed.")
          unsubscribeRef.current = unsubscribe
        } else if (!unsubscribe && isMountedRef.current) {
          console.error("AuthProvider: Failed to get unsubscribe function from onAuthStateChanged.")
          setError(new Error("Failed to initialize authentication listener."))
          setLoading(false)
          setAuthInitialized(true)
        }
      } catch (setupError) {
        console.error("AuthProvider: Error setting up auth listener:", setupError)
        if (isMountedRef.current) {
          setError(setupError instanceof Error ? setupError : new Error(String(setupError)))
          setLoading(false)
          setAuthInitialized(true)
        }
      }
    }

    setupAuthListener().catch((err) => {
      console.error("Unhandled error in setupAuthListener:", err)
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
        setAuthInitialized(true)
      }
    })

    return () => {
      clearTimeout(timeoutId)
      isMountedRef.current = false
      if (unsubscribeRef.current) {
        console.log("AuthProvider: Unsubscribing listener.")
        unsubscribeRef.current()
        unsubscribeRef.current = null
      } else {
        console.log("AuthProvider: Unmounting, no active listener to unsubscribe.")
      }
    }
  }, [authInitialized])

  const contextValue = {
    user,
    loading,
    error,
    authInitialized,
  }

  if (loading && !authInitialized) {
    return <LoadingScreen />
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

// Export useAuth hook for components to use
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Also export as default for backward compatibility
export default AuthProvider
