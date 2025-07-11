import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getMessaging, type Messaging } from "firebase/messaging"

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebaseの初期化
let app: ReturnType<typeof initializeApp> | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let messaging: Messaging | undefined

// クライアントサイドのみで実行
if (typeof window !== "undefined") {
  try {
    // Firebaseアプリの初期化
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
    // Auth, Firestoreの初期化
    auth = getAuth(app)
    db = getFirestore(app)

    // PWA環境でのみメッセージングを初期化
    // Webプッシュ通知はLINE通知に置き換えられたため、関連コードは削除または無効化されます。
  // 必要に応じて、将来的に再導入することも可能です。
  } catch (error) {
    console.error("Firebase initialization error:", error)
  }
}

export { app, auth, db, messaging }

