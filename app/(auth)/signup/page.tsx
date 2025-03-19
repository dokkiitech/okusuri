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
import { toast } from "@/hooks/use-toast"

const signupFormSchema = z
  .object({
    displayName: z.string().min(2, "名前は2文字以上である必要があります"),
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上である必要があります"),
    confirmPassword: z.string().min(6, "パスワードは6文字以上である必要があります"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  })

export default function SignupPage() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof signupFormSchema>>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: z.infer<typeof signupFormSchema>) {
    setIsLoading(true)

    try {
      await signUp(values.email, values.password, values.displayName)
      toast({
        title: "アカウントを作成しました",
        description: "ログインしました",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("アカウント作成に失敗しました:", error)

      let errorMessage = "アカウント作成に失敗しました"

      // Firebase のエラーコードに基づいてメッセージをカスタマイズ
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "このメールアドレスは既に使用されています"
      }

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
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">アカウント作成</h1>
        <p className="text-gray-500">新しいアカウントを作成してください</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>名前</FormLabel>
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
                  <Input placeholder="your@email.com" {...field} />
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
                  <Input type="password" placeholder="******" {...field} />
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
                  <Input type="password" placeholder="******" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "アカウント作成中..." : "アカウント作成"}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          既にアカウントをお持ちの場合は{" "}
          <Link href="/login" className="text-primary hover:underline">
            ログイン
          </Link>
          してください
        </p>
      </div>
    </div>
  )
}

