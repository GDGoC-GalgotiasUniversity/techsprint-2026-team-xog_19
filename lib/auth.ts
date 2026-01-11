import { getAuth, type UserRecord } from "firebase-admin/auth"
import { getApps, initializeApp } from "firebase-admin/app"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBmT9icPBVZFH-jKgZRJ3y-0hRXbwYwTJw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project-12345.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project-12345",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project-12345.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:a1b2c3d4e5f6a7b8c9d0e1",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase Admin if not already initialized
function initializeAdmin() {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig)
  }
}

/**
 * Verify Firebase ID token using Firebase Admin SDK
 */
export async function verifyFirebaseIdToken(token: string): Promise<UserRecord | null> {
  try {
    initializeAdmin()
    const auth = getAuth()
    const decodedToken = await auth.verifyIdToken(token)
    return decodedToken
  } catch (error: any) {
    console.error("Error verifying Firebase ID token:", error.message)
    return null
  }
}
