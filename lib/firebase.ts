import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging } from "firebase/messaging"

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebaseアプリの初期化
let app
let auth
let db
let messaging

// クライアントサイドのみで実行
if (typeof window !== "undefined") {
  try {
    // Firebaseアプリの初期化
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

    // Auth, Firestoreの初期化
    auth = getAuth(app)
    db = getFirestore(app)

    // PWA環境でのみメッセージングを初期化
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        messaging = getMessaging(app)
      } catch (e) {
        console.log("Messaging could not be initialized:", e)
      }
    }
  } catch (error) {
    console.error("Firebase initialization error:", error)
  }
}

export { app, auth, db, messaging }

