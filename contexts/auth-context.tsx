"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

type AuthContextType = {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth is not initialized")
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser ? currentUser.email : "No user")
      if (currentUser) {
        setUser(currentUser)

        // ユーザー情報をFirestoreに保存/更新
        try {
          if (!db) {
            console.error("Firestore is not initialized")
            return
          }

          const userRef = doc(db, "users", currentUser.uid)
          const userSnap = await getDoc(userRef)

          if (!userSnap.exists()) {
            // 新規ユーザーの場合、Firestoreにユーザー情報を作成
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        } catch (error) {
          console.error("ユーザー情報の保存に失敗しました:", error)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!auth || !db) {
      console.error("Firebase is not initialized")
      throw new Error("Firebase is not initialized")
    }

    try {
      setLoading(true)
      console.log("Signing up with:", email)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // ユーザープロフィールの表示名を更新
      await updateProfile(user, { displayName })

      // Firestoreにユーザー情報を保存
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return
    } catch (error) {
      console.error("サインアップに失敗しました:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      console.error("Firebase Auth is not initialized")
      throw new Error("Firebase Auth is not initialized")
    }

    try {
      setLoading(true)
      console.log("Signing in with:", email)
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error("ログインに失敗しました:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized")
      throw new Error("Firebase Auth is not initialized")
    }

    try {
      setLoading(true)
      await signOut(auth)
    } catch (error) {
      console.error("ログアウトに失敗しました:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    if (!auth) {
      console.error("Firebase Auth is not initialized")
      throw new Error("Firebase Auth is not initialized")
    }

    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      console.error("パスワードリセットメールの送信に失敗しました:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

