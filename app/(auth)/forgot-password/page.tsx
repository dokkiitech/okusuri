"use client"

import { useState } from "react"
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
import { Pill } from "lucide-react"

const resetPasswordSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
})

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (data: ResetPasswordValues) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await resetPassword(data.email)
      setSuccess(true)
      toast({
        title: "メール送信完了",
        description: "パスワードリセット用のメールを送信しました。メールをご確認ください。",
      })
    } catch (error: any) {
      console.error("パスワードリセットエラー:", error)

      // エラーメッセージを日本語化
      let errorMessage = "パスワードリセットメールの送信に失敗しました。もう一度お試しください。"

      if (error.code === "auth/user-not-found") {
        errorMessage = "このメールアドレスに登録されているアカウントが見つかりません"
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "無効なメールアドレスです"
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "ネットワークエラーが発生しました。インターネット接続を確認してください"
      }

      setError(errorMessage)
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
          <div className="flex justify-center mb-4">
            <div className="bg-primary p-2 rounded-full">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">パスワードをリセット</CardTitle>
          <CardDescription className="text-center">登録したメールアドレスを入力してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-md">
              <p className="text-center">
                パスワードリセット用のメールを送信しました。メールの指示に従ってパスワードをリセットしてください。
              </p>
            </div>
          ) : (
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
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "送信中..." : "リセットメールを送信"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              ログインページに戻る
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

