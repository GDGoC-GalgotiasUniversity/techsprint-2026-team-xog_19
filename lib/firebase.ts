// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import type { Auth } from "firebase/auth"
import type { Firestore } from "firebase/firestore"

// Your web app's Firebase configuration with fallbacks for development
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBmT9icPBVZFH-jKgZRJ3y-0hRXbwYwTJw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project-12345.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project-12345",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project-12345.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:a1b2c3d4e5f6a7b8c9d0e1",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Global variables to track initialization state
let firebaseInitialized = false
let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

// Helper function to check if we're in a browser environment
const isBrowser = typeof window !== "undefined"

/**
 * Initialize Firebase app only (not services)
 */
export function initializeFirebase(): FirebaseApp | null {
  // Server-side safety check
  if (!isBrowser) {
    return null
  }

  // Return existing app if already initialized
  if (firebaseInitialized && app) {
    return app
  }

  try {
    // Check for existing apps
    if (getApps().length > 0) {
      app = getApps()[0]
    } else {
      // Initialize new app
      app = initializeApp(firebaseConfig)
      console.log("Firebase app initialized successfully")
    }

    firebaseInitialized = true
    return app
  } catch (error) {
    console.error("Error initializing Firebase app:", error)
    return null
  }
}

/**
 * Get Firebase Auth instance with lazy loading
 */
export async function getAuth(): Promise<Auth | null> {
  // Server-side safety check
  if (!isBrowser) {
    return null
  }

  // Return cached instance if available
  if (auth) {
    return auth
  }

  try {
    // Make sure Firebase app is initialized
    const app = initializeFirebase()
    if (!app) {
      throw new Error("Firebase app initialization failed")
    }

    // Dynamically import Firebase Auth
    const { getAuth: firebaseGetAuth } = await import("firebase/auth")

    // Initialize Auth
    auth = firebaseGetAuth(app)
    console.log("Firebase Auth initialized successfully")
    return auth
  } catch (error) {
    console.error("Error initializing Firebase Auth:", error)
    return null
  }
}

/**
 * Get Firebase Firestore instance with lazy loading
 */
export async function getFirestore(): Promise<Firestore | null> {
  if (firestore) return firestore

  try {
    const { initializeApp, getApps } = await import("firebase/app")
    const { getFirestore: firebaseGetFirestore } = await import("firebase/firestore")

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    firestore = firebaseGetFirestore(app)
    return firestore
  } catch (error) {
    console.error("Error initializing Firestore:", error)
    return null
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmailAndPassword(email: string, password: string) {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      throw new Error("Auth service is not available")
    }

    // Dynamically import signInWithEmailAndPassword
    const { signInWithEmailAndPassword: firebaseSignIn } = await import("firebase/auth")

    // Sign in
    return await firebaseSignIn(authInstance, email, password)
  } catch (error) {
    console.error("Error signing in:", error)
    throw error
  }
}

/**
 * Create user with email and password
 */
export async function createUserWithEmailAndPassword(email: string, password: string) {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      throw new Error("Auth service is not available")
    }

    // Dynamically import createUserWithEmailAndPassword
    const { createUserWithEmailAndPassword: firebaseCreateUser } = await import("firebase/auth")

    // Create user
    return await firebaseCreateUser(authInstance, email, password)
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

/**
 * Sign out
 */
export async function signOut() {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      throw new Error("Auth service is not available")
    }

    // Dynamically import signOut
    const { signOut: firebaseSignOut } = await import("firebase/auth")

    // Sign out
    return await firebaseSignOut(authInstance)
  } catch (error) {
    console.error("Error signing out:", error)
    throw error
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  // Server-side safety check
  if (!isBrowser) {
    return null
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      return null
    }

    // Return current user
    return authInstance.currentUser
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

/**
 * Set up auth state listener
 */
export async function onAuthStateChanged(callback: (user: any) => void): Promise<() => void> {
  // Server-side safety check
  if (!isBrowser) {
    return () => {}
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      console.warn("Auth service not available for listener setup")
      return () => {}
    }

    // Dynamically import onAuthStateChanged
    const { onAuthStateChanged: firebaseOnAuthStateChanged } = await import("firebase/auth")

    // Set up listener
    return firebaseOnAuthStateChanged(authInstance, callback)
  } catch (error) {
    console.error("Error setting up auth state listener:", error)
    return () => {}
  }
}

/**
 * Change password
 */
export async function changePassword(newPassword: string): Promise<void> {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance || !authInstance.currentUser) {
      throw new Error("User not authenticated")
    }

    // Dynamically import updatePassword
    const { updatePassword } = await import("firebase/auth")

    // Update password
    await updatePassword(authInstance.currentUser, newPassword)
  } catch (error) {
    console.error("Error changing password:", error)
    throw error
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance) {
      throw new Error("Auth service is not available")
    }

    // Dynamically import sendPasswordResetEmail
    const { sendPasswordResetEmail: firebaseSendPasswordResetEmail } = await import("firebase/auth")

    // Send password reset email
    await firebaseSendPasswordResetEmail(authInstance, email)
  } catch (error) {
    console.error("Error sending password reset email:", error)
    throw error
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(profile: { displayName?: string; photoURL?: string }): Promise<void> {
  // Server-side safety check
  if (!isBrowser) {
    throw new Error("Authentication can only be performed in browser environment")
  }

  try {
    // Get auth instance
    const authInstance = await getAuth()
    if (!authInstance || !authInstance.currentUser) {
      throw new Error("User not authenticated")
    }

    // Dynamically import updateProfile
    const { updateProfile } = await import("firebase/auth")

    // Update profile
    await updateProfile(authInstance.currentUser, profile)
  } catch (error) {
    console.error("Error updating user profile:", error)
    throw error
  }
}

// Initialize Firebase app when this module is imported (client-side only)
if (isBrowser) {
  // Only initialize the Firebase app, not services
  initializeFirebase()
}

// Export a lazy-loaded db reference
export const db = {
  get: async (): Promise<Firestore | null> => {
    return await getFirestore()
  },
}

// Helper functions to check if services are available
export function isFirebaseAuthAvailable(): boolean {
  return !!auth
}

export function isFirestoreAvailable(): boolean {
  return !!firestore
}

// For backward compatibility
export { getAuth as getFirebaseAuth, getFirestore as getFirebaseFirestore }

// Add the missing export for backward compatibility
export const initFirebase = initializeFirebase
