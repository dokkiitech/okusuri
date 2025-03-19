"use client"

import { useState } from "react"
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
import { Pill } from "lucide-react"

const registerFormSchema = z
  .object({
    name: z.string().min(2, "名前は2文字以上である必要があります"),
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上である必要があります"),
    confirmPassword: z.string().min(6, "パスワードは6文字以上である必要があります"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  })

type RegisterFormValues = z.infer<typeof registerFormSchema>

export default function RegisterPage() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true)
    setError(null)

    try {
      await signUp(data.email, data.password, data.name)
      toast({
        title: "アカウント作成成功",
        description: "アカウントが正常に作成されました",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("登録エラー:", error)

      // エラーメッセージを日本語化
      let errorMessage = "アカウント作成に失敗しました。もう一度お試しください。"

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "このメールアドレスは既に使用されています"
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "無効なメールアドレスです"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "パスワードが弱すぎます。より強力なパスワードを設定してください"
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
          <CardTitle className="text-2xl text-center">アカウント作成</CardTitle>
          <CardDescription className="text-center">新しいアカウントを作成して服薬管理を始めましょう</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>お名前</FormLabel>
                    <FormControl>
                      <Input placeholder="山田 太郎" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input type="password" placeholder="******" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード（確認）</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "アカウント作成中..." : "アカウント作成"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm">
            既にアカウントをお持ちの場合は
            <Link href="/login" className="text-primary hover:underline ml-1">
              ログイン
            </Link>
            してください
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

