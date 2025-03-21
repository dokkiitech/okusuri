"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"

interface ErrorHandlerProps {
  error: Error | null
  resetError: () => void
}

export function ErrorHandler({ error, resetError }: ErrorHandlerProps) {
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    if (!error) return

    // Firebaseのエラーメッセージをユーザーフレンドリーなメッセージに変換
    if (error.message.includes("Missing or insufficient permissions")) {
      setErrorMessage("アクセス権限がありません。連携設定を確認してください。")
    } else {
      setErrorMessage(error.message)
    }

    // 5秒後にエラーをリセット
    const timer = setTimeout(() => {
      resetError()
    }, 5000)

    return () => clearTimeout(timer)
  }, [error, resetError])

  if (!error) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <ShieldAlert className="h-4 w-4 mr-2" />
      <AlertTitle>エラーが発生しました</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  )
}

