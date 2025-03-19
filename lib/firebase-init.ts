"use client"

import { useEffect, useState } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

export function useFirebase() {
  const [app, setApp] = useState(null)
  const [db, setDb] = useState(null)
  const [auth, setAuth] = useState(null)
  const [storage, setStorage] = useState(null)
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
        const firestore = getFirestore(firebaseApp)
        const authentication = getAuth(firebaseApp)
        const firebaseStorage = getStorage(firebaseApp)

        setApp(firebaseApp)
        setDb(firestore)
        setAuth(authentication)
        setStorage(firebaseStorage)
        setLoading(false)
      } catch (err) {
        console.error("Firebase initialization error:", err)
        setError(err)
        setLoading(false)
      }
    }

    initializeFirebase()
  }, [])

  return { app, db, auth, storage, loading, error }
}

