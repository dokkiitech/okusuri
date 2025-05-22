"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { askGemini } from "@/lib/gemini"
import { Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function AskPage() {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) {
      toast({
        title: "エラー",
        description: "質問を入力してください",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await askGemini(question)
      setAnswer(response)
    } catch (error) {
      toast({
        title: "エラー",
        description: "回答の生成中にエラーが発生しました",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">お薬の飲み合わせ相談</h1>
        <p className="text-muted-foreground mt-2">
          AIアシスタントに、お薬の飲み合わせについて質問できます。
          ただし、これは一般的な情報提供であり、具体的な医療アドバイスではありません。
          必ず医師や薬剤師に相談してください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>質問を入力</CardTitle>
          <CardDescription>
            お薬の飲み合わせについて、具体的な質問を入力してください。
            例：「アスピリンとロキソプロフェンの併用は大丈夫ですか？」
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="お薬の飲み合わせについて質問してください..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px]"
              disabled={loading}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  回答を生成中...
                </>
              ) : (
                "質問する"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {answer && (
        <Card>
          <CardHeader>
            <CardTitle>回答</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              {answer.split("\n").map((line, i) => (
                <p key={i} className="mb-2">
                  {line}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 