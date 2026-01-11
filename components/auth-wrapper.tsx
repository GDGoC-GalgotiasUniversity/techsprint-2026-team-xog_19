"use client"

import { useState, type ReactNode } from "react"
import { AuthProvider } from "@/hooks/use-auth"

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)

  if (error) {
    console.error("Auth wrapper error:", error)
    return <>{children}</>
  }

  try {
    return <AuthProvider>{children}</AuthProvider>
  } catch (err) {
    console.error("Error in AuthWrapper:", err)
    setError(err instanceof Error ? err : new Error(String(err)))
    return <>{children}</>
  }
}
