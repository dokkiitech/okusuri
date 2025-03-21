"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { auth } from "@/lib/firebase"

const loginFormSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(6, "パスワードは6文字以上である必要があります"),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firebaseInitialized, setFirebaseInitialized] = useState<boolean>(false)
  const [envVars, setEnvVars] = useState<string>("")

  useEffect(() => {
    // Firebase初期化状態を確認
    setFirebaseInitialized(!!auth)

    // 環境変数の確認（APIキーは部分的に表示）
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "未設定"
    const maskedApiKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)

    setEnvVars(`API Key: ${maskedApiKey}, Auth Domain: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "未設定"}`)
  }, [])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("ログイン試行:", data.email)
      await signIn(data.email, data.password)
      console.log("ログイン成功")
      toast({
        title: "ログイン成功",
        description: "アプリにログインしました",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("ログインエラー:", error)

      // エラーメッセージを日本語化
      let errorMessage = "ログインに失敗しました。もう一度お試しください。"

      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "メールアドレスまたはパスワードが正しくありません"
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "ログイン試行回数が多すぎます。しばらく時間をおいてから再度お試しください"
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "ネットワークエラーが発生しました。インターネット接続を確認してください"
      }

      setError(`${errorMessage} (${error.code || "不明なエラー"})`)
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">服薬管理アプリ</CardTitle>
            <CardDescription className="text-center">アカウントにログインして服薬管理を始めましょう</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!firebaseInitialized && (
                <div className="p-2 bg-amber-50 text-amber-700 rounded-md text-sm mb-4">
                  <p>Firebase認証が初期化されていません。環境変数を確認してください。</p>
                  <p className="text-xs mt-1">{envVars}</p>
                  <Link href="/debug" className="text-xs text-blue-600 hover:underline block mt-1">
                    詳細な環境変数情報を確認
                  </Link>
                </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>メールアドレス</FormLabel>
                          <FormControl>
                            <Input placeholder="your-email@example.com" {...field} autoComplete="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel>パスワード</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="******" {...field} autoComplete="current-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                />
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading || !firebaseInitialized}>
                  {isLoading ? "ログイン中..." : "ログイン"}
                </Button>
              </form>
            </Form>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                パスワードをお忘れですか？
              </Link>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center text-sm">
              アカウントをお持ちでない場合は
              <Link href="/register" className="text-primary hover:underline ml-1">
                新規登録
              </Link>
              してください
            </div>
            <div className="text-center text-xs text-muted-foreground">
              <Link href="/debug" className="hover:underline">
                環境変数情報
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
  )
}

