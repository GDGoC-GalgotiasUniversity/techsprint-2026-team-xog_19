"use client"

import { createContext, useState, useEffect, useRef, useContext, type ReactNode } from "react"
import { onAuthStateChanged, getAuth } from "../lib/firebase"
import OnboardingModal from "@/components/onboarding-modal"
import type { User } from "firebase/auth"

// Create the AuthContext
export interface AuthContextType {
  user: User | null
  loading: boolean
  error: Error | null
  authInitialized: boolean
  userProfile?: Record<string, any> | null
  saveUserProfile?: (data: Record<string, any>) => Promise<void>
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  authInitialized: false,
})

// Create the AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)
  const [userProfile, setUserProfile] = useState<Record<string, any> | null | undefined>(undefined)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const isMountedRef = useRef(true)

  // Update the useEffect in AuthProvider to be more resilient
  useEffect(() => {
    isMountedRef.current = true
    console.log("AuthProvider: Mounting and setting up listener.")
    let authInitTimer: NodeJS.Timeout

    const setupAuthListener = async () => {
      try {
        // Add a significant delay before setting up the auth state listener
        // This gives Firebase time to fully initialize
        console.log("AuthProvider: Waiting before setting up auth listener...")
        await new Promise((resolve) => setTimeout(resolve, 1000))

        console.log("AuthProvider: Setting up auth state listener...")

        // Try to get auth with retries
        let authInstance = null
        let retries = 0

        while (!authInstance && retries < 3) {
          try {
            authInstance = await getAuth()
            if (!authInstance) {
              throw new Error("Auth not available")
            }
          } catch (authError) {
            retries++
            console.warn(`Failed to get auth instance, attempt ${retries}/3`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }

        if (!authInstance) {
          throw new Error("Could not initialize Firebase Auth after multiple attempts")
        }

        const unsubscribe = await onAuthStateChanged((authUser) => {
          if (!isMountedRef.current) {
            console.log("AuthProvider: Auth state changed but component unmounted.")
            return
          }

          console.log("AuthProvider: onAuthStateChanged triggered. User:", authUser ? authUser.uid : "null")
          setUser(authUser)
          setUserProfile(undefined)
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

    setupAuthListener()

    // Set a timeout to ensure auth initialization doesn't hang indefinitely
    authInitTimer = setTimeout(() => {
      if (isMountedRef.current && !authInitialized) {
        console.warn("AuthProvider: Auth initialization timed out")
        setLoading(false)
        setAuthInitialized(true)
        setError(new Error("Authentication initialization timed out"))
      }
    }, 10000) // 10 second timeout

    return () => {
      clearTimeout(authInitTimer)
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

  // Load user profile when user changes
  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!user) {
        setUserProfile(null)
        return
      }

      try {
        const firestore = await import("@/lib/firebase").then((m) => m.getFirestore())
        if (!firestore) {
          setUserProfile(null)
          return
        }

        const { doc, getDoc } = await import("firebase/firestore")
        const userDoc = await getDoc(doc(firestore, "users", user.uid))
        if (cancelled) return
        if (userDoc.exists()) {
          setUserProfile(userDoc.data())
        } else {
          setUserProfile(null)
        }
      } catch (e) {
        console.warn("Failed to load user profile:", e)
        if (!cancelled) setUserProfile(null)
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [user])

  const saveUserProfile = async (data: Record<string, any>) => {
    if (!user) throw new Error("Not authenticated")
    try {
      const firestore = await import("@/lib/firebase").then((m) => m.getFirestore())
      if (!firestore) throw new Error("Firestore not available")

      const { doc, setDoc } = await import("firebase/firestore")
      await setDoc(doc(firestore, "users", user.uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
      setUserProfile((prev) => ({ ...(prev || {}), ...data }))
    } catch (e) {
      console.error("Failed to save user profile:", e)
      throw e
    }
  }

  const extendedContext = {
    ...contextValue,
    userProfile,
    saveUserProfile,
  }

  return (
    <AuthContext.Provider value={extendedContext}>
      {children}
      {user && userProfile === null && (
        <OnboardingModal
          open={true}
          onClose={async () => {
            try {
              await saveUserProfile?.({})
            } catch (e) {
              console.warn("Skipping onboarding failed to save empty profile", e)
            }
          }}
          onSave={async (d: { occupation: string; age: number }) => {
            await saveUserProfile?.({ occupation: d.occupation, age: d.age, createdAt: new Date().toISOString() })
          }}
        />
      )}
    </AuthContext.Provider>
  )
}

// Create the useAuth hook
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Export the hook as a named export
