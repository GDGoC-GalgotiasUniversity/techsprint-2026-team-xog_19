"use client"

import { useEffect } from "react"

import type React from "react"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, Calendar, Brain } from "lucide-react"
import dynamic from "next/dynamic"

// Dynamically import the auth check component with no SSR
const DynamicAuthCheck = dynamic(() => import("@/components/home-auth-check").catch(() => () => null), {
  ssr: false,
  loading: () => null,
})

// The main content of the home page without any auth dependencies
function HomePageContent() {
  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">Unbusy</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                  Manage Your Tasks with AI-Powered Intelligence
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Unbusy helps you organize, prioritize, and complete your tasks efficiently with AI assistance.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/signup">
                  <Button size="lg" className="w-full">
                    Get Started
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="w-full">
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-secondary py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Task Management</h3>
                  <p className="text-muted-foreground">
                    Create, organize, and track your tasks with ease. Set priorities, deadlines, and categories.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Smart Scheduling</h3>
                  <p className="text-muted-foreground">
                    Let AI optimize your schedule based on task priorities, deadlines, and your availability.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">AI Assistant</h3>
                  <p className="text-muted-foreground">
                    Get personalized productivity tips and task suggestions from our AI assistant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Ready to boost your productivity?</h2>
                <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
                  Join thousands of users who have transformed their task management with Unbusy.
                </p>
              </div>
              <Link href="/signup">
                <Button size="lg">Sign Up Now</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-background py-6">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-primary">Unbusy</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Unbusy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}

// Create a component that handles errors in the auth check
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return null
  }

  return <ErrorCatcher onError={() => setHasError(true)}>{children}</ErrorCatcher>
}

// Simple error catcher component
function ErrorCatcher({
  children,
  onError,
}: {
  children: React.ReactNode
  onError: () => void
}) {
  useEffect(() => {
    const handleError = () => {
      onError()
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [onError])

  return <>{children}</>
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <ErrorBoundary>
        <Suspense fallback={null}>
          <DynamicAuthCheck />
        </Suspense>
      </ErrorBoundary>
      <HomePageContent />
    </div>
  )
}
