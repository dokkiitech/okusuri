"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"

const frequencyItems = [
  { id: "朝", label: "朝" },
  { id: "昼", label: "昼" },
  { id: "晩", label: "晩" },
  { id: "就寝前", label: "就寝前" },
]

const medicationFormSchema = z.object({
  name: z.string().min(1, "お薬の名前を入力してください"),
  dosagePerTime: z.coerce.number().min(1, "1以上の数値を入力してください"),
  frequency: z.array(z.string()).min(1, "服用タイミングを選択してください"),
  prescriptionDays: z.coerce.number().min(1, "1以上の数値を入力してください"),
  notes: z.string().optional(),
})

type MedicationFormValues = z.infer<typeof medicationFormSchema>

export default function EditMedicationPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [takenCount, setTakenCount] = useState(0)
  const [originalMedication, setOriginalMedication] = useState<any>(null)

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: {
      name: "",
      dosagePerTime: 1,
      frequency: [],
      prescriptionDays: 14,
      notes: "",
    },
  })

  useEffect(() => {
    if (!user || !params.id || !db) return

    const fetchMedication = async () => {
      try {
        const medicationDoc = await getDoc(doc(db, "medications", params.id))

        if (medicationDoc.exists()) {
          const medicationData = medicationDoc.data()
          setOriginalMedication(medicationData)

          // ユーザーIDが一致するか確認
          if (medicationData.userId !== user.uid) {
            toast({
              title: "エラー",
              description: "このお薬の編集権限がありません",
              variant: "destructive",
            })
            router.push("/medications")
            return
          }

          // 服用回数を取得
          setTakenCount(medicationData.takenCount || 0)

          form.reset({
            name: medicationData.name,
            dosagePerTime: medicationData.dosagePerTime || 1,
            frequency: Array.isArray(medicationData.frequency) ? medicationData.frequency : [],
            prescriptionDays: medicationData.prescriptionDays || 14,
            notes: medicationData.notes || "",
          })
        } else {
          toast({
            title: "エラー",
            description: "お薬が見つかりませんでした",
            variant: "destructive",
          })
          router.push("/medications")
        }
      } catch (error) {
        console.error("お薬データの取得に失敗しました:", error)
        toast({
          title: "エラー",
          description: "お薬データの取得に失敗しました",
          variant: "destructive",
        })
        router.push("/medications")
      } finally {
        setLoading(false)
      }
    }

    fetchMedication()
  }, [user, params.id, router, form, db])

  const onSubmit = async (data: MedicationFormValues) => {
    if (!user || !params.id || !db) return

    setIsSubmitting(true)
    try {
      // 総錠数を計算: 処方日数 × 1日の服用回数（タイミングの数）× 1回あたりの服薬数
      const totalPills = data.prescriptionDays * data.frequency.length * data.dosagePerTime

      // 残数を計算: 総錠数 - 服用回数 × 1回あたりの服薬数
      const remainingPills = Math.max(0, totalPills - takenCount * data.dosagePerTime)

      await updateDoc(doc(db, "medications", params.id), {
        name: data.name,
        dosagePerTime: data.dosagePerTime,
        frequency: data.frequency,
        prescriptionDays: data.prescriptionDays,
        totalPills: totalPills,
        remainingPills: remainingPills,
        notes: data.notes,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "お薬を更新しました",
        description: `${data.name}が正常に更新されました`,
      })

      router.push("/medications")
    } catch (error) {
      console.error("お薬の更新に失敗しました:", error)
      toast({
        title: "エラー",
        description: "お薬の更新に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mr-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">お薬を編集</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>お薬情報</CardTitle>
          <CardDescription>お薬の情報を編集してください</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>お薬の名前</FormLabel>
                    <FormControl>
                      <Input placeholder="例: ロキソニン" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dosagePerTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1回あたりの服薬数</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="例: 1" {...field} />
                    </FormControl>
                    <FormDescription>1回に服用する錠数・カプセル数を入力してください</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>服用タイミング</FormLabel>
                      <FormDescription>服用するタイミングを選択してください</FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {frequencyItems.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="frequency"
                          render={({ field }) => {
                            return (
                              <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, item.id])
                                        : field.onChange(field.value?.filter((value) => value !== item.id))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{item.label}</FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescriptionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>処方日数</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormDescription>処方された日数を入力してください（例: 14日分）</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メモ（任意）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="服用に関する注意点などを記入してください"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

