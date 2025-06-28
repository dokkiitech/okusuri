"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
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
  { id: "頓服", label: "頓服" }, // 頓服を追加
]

const medicationFormSchema = z.object({
  name: z.string().min(1, "お薬の名前を入力してください"),
  dosagePerTime: z.coerce.number().min(1, "1以上の数値を入力してください"),
  frequency: z.array(z.string()).min(1, "服用タイミングを選択してください"),
  prescriptionDays: z.coerce.number().min(1, "1以上の数値を入力してください"),
  notes: z.string().optional(),
  // 編集時には totalPills と remainingPills はフォームで直接編集せず、
  // prescriptionDays や dosagePerTime, frequency の変更に応じて再計算する
})

type MedicationFormValues = z.infer<typeof medicationFormSchema>

interface MedicationData extends MedicationFormValues {
  id: string
  userId: string
  totalPills: number
  remainingPills: number
  takenCount: number
  createdAt: any
  updatedAt: any
}

export default function EditMedicationPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const medicationId = params.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [initialMedicationData, setInitialMedicationData] = useState<MedicationData | null>(null)

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
    const checkParentalStatus = async () => {
      if (!user || !db) {
        setLoadingParentalCheck(false)
        return
      }
      try {
        const userSettingsRef = doc(db, "userSettings", user.uid)
        const userSettingsSnap = await getDoc(userSettingsRef)
        if (userSettingsSnap.exists()) {
          const settings = userSettingsSnap.data()
          if (settings.linkedAccounts && settings.linkedAccounts.length > 0) {
            setIsParentAccount(true)
            router.replace("/medications") // 親アカウントの場合はリダイレクト
            return
          }
        }
      } catch (error) {
        console.error("Failed to check parental status:", error)
      } finally {
        setLoadingParentalCheck(false)
      }
    }
    checkParentalStatus()
  }, [user, router])

  useEffect(() => {
    if (!user || !medicationId || !db || loadingParentalCheck || isParentAccount) return

    const fetchMedication = async () => {
      setIsLoading(true)
      try {
        const medicationRef = doc(db, "medications", medicationId)
        const medicationSnap = await getDoc(medicationRef)

        if (medicationSnap.exists()) {
          const data = medicationSnap.data() as MedicationData
          setInitialMedicationData(data) // 元のデータを保持
          form.reset({
            name: data.name,
            dosagePerTime: data.dosagePerTime,
            frequency: data.frequency,
            prescriptionDays: data.prescriptionDays,
            notes: data.notes || "",
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
      } finally {
        setIsLoading(false)
      }
    }

    fetchMedication()
  }, [user, medicationId, form, router, db, loadingParentalCheck, isParentAccount])

  const onSubmit = async (data: MedicationFormValues) => {
    if (!user || !medicationId || !initialMedicationData || isParentAccount) return

    setIsSubmitting(true)
    try {
      const medicationRef = doc(db, "medications", medicationId)

      // 処方日数、1回の服用数、服用タイミングの変更に応じて総錠数と残数を再計算
      // ただし、服用済み回数は考慮する
      const oldTotalPills = initialMedicationData.totalPills
      const oldRemainingPills = initialMedicationData.remainingPills
      const takenPills = oldTotalPills - oldRemainingPills // これまでに服用した総錠数

      const newTotalPills = data.prescriptionDays * data.frequency.length * data.dosagePerTime
      const newRemainingPills = Math.max(0, newTotalPills - takenPills) // 新しい残数

      await updateDoc(medicationRef, {
        name: data.name,
        dosagePerTime: data.dosagePerTime,
        frequency: data.frequency,
        prescriptionDays: data.prescriptionDays,
        totalPills: newTotalPills,
        remainingPills: newRemainingPills,
        notes: data.notes,
        updatedAt: serverTimestamp(),
        // userId, createdAt, takenCount は変更しない
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

  if (isLoading) {
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
                                        ? field.onChange([...(field.value || []), item.id])
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
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? "保存中..." : "更新"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
