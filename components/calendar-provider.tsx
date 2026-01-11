"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { initializeGoogleCalendarOnLoad } from "@/lib/calendar-service"

type CalendarContextType = {
  isInitialized: boolean
  isLoading: boolean
  error: Error | null
}

const CalendarContext = createContext<CalendarContextType>({
  isInitialized: false,
  isLoading: true,
  error: null,
})

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function initCalendar() {
      try {
        setIsLoading(true)
        const initialized = await initializeGoogleCalendarOnLoad()
        setIsInitialized(initialized)
      } catch (err) {
        console.error("Failed to initialize Google Calendar:", err)
        setError(err instanceof Error ? err : new Error("Failed to initialize calendar"))
      } finally {
        setIsLoading(false)
      }
    }

    initCalendar()
  }, [])

  return (
    <CalendarContext.Provider
      value={{
        isInitialized,
        isLoading,
        error,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider")
  }
  return context
}
