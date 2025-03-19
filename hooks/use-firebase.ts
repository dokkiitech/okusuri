"use client"

import { useState, useEffect } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging } from "firebase/messaging"

export function useFirebase() {
  const [app, setApp] = useState(null)
  const [auth, setAuth] = useState(null)
  const [db, setDb] = useState(null)
  const [messaging, setMessaging] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function initializeFirebase() {
      try {
        // サーバーから Firebase の設定を取得
        const response = await fetch("/api/firebase-config")
        const firebaseConfig = await response.json()

        // Firebase アプリの初期化
        const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp()

        // Firestore、Auth、Storage の初期化
        const firebaseAuth = getAuth(firebaseApp)
        const firestore = getFirestore(firebaseApp)

        setApp(firebaseApp)
        setAuth(firebaseAuth)
        setDb(firestore)

        // PWA環境でのみメッセージングを初期化
        if ("serviceWorker" in navigator && "PushManager" in window) {
          try {
            const firebaseMessaging = getMessaging(firebaseApp)
            setMessaging(firebaseMessaging)
          } catch (e) {
            console.log("Messaging could not be initialized:", e)
          }
        }

        setLoading(false)
      } catch (err) {
        console.error("Firebase initialization error:", err)
        setError(err)
        setLoading(false)
      }
    }

    initializeFirebase()
  }, [])

  return { app, auth, db, messaging, loading, error }
}

