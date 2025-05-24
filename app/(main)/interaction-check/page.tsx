"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { askGemini } from "@/lib/gemini"
import { Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Medication {
  id: string
  name: string
  dosagePerTime: number
  frequency: string[]
  notes?: string
}

export default function InteractionCheckPage() {
  const { user } = useAuth()
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [medications, setMedications] = useState<Medication[]>([])

  useEffect(() => {
    if (!user || !db) return

    const fetchMedications = async () => {
      try {
        if (!db) return
        const medicationsQuery = query(collection(db, "medications"), where("userId", "==", user.uid))
        const medicationsSnapshot = await getDocs(medicationsQuery)
        const medicationsData = medicationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Medication[]

        setMedications(medicationsData)
      } catch (error) {
        console.error("お薬データの取得に失敗しました:", error)
        toast({
          title: "エラー",
          description: "お薬データの取得に失敗しました",
          variant: "destructive",
        })
      }
    }

    fetchMedications()
  }, [user, db])

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
      // 現在服用中の薬剤情報を含めた質問を作成
      const currentMedications = medications
        .map(med => `${med.name}（${med.dosagePerTime}錠/回、${med.frequency.join('・')}）`)
        .join('\n')

      const prompt = `以下の薬を現在服用中です：

${currentMedications}

質問：${question}

上記の服用中の薬剤と、質問で言及されている薬剤の飲み合わせについて、具体的に教えてください。
服薬中の薬剤から症状を推測し、その結果飲み合わせが悪い場合はその理由と注意点を詳しく説明してください。
特に、飲み合わせが悪い場合は、その理由と注意点を詳しく説明してください。
また、飲み合わせが悪い場合は、現在服用中の薬剤の中で、どの薬剤との組み合わせが問題となるのかも明記してください。`

      const response = await askGemini(prompt)
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
        <h1 className="text-3xl font-bold tracking-tight">お薬の飲み合わせチェック</h1>
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