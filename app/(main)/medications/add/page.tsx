"use client"

import { useState } from "react"
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
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import { useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"

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
})

type MedicationFormValues = z.infer<typeof medicationFormSchema>

export default function AddMedicationPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isParentAccount, setIsParentAccount] = useState(false)
  const [loadingParentalCheck, setLoadingParentalCheck] = useState(true)

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

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: {
      name: "",
      dosagePerTime: 1,
      frequency: [],
      prescriptionDays: 14, // デフォルトは2週間
      notes: "",
    },
  })

  const onSubmit = async (data: MedicationFormValues) => {
    if (!user || isParentAccount) return


    setIsSubmitting(true)
    try {
      // 残数を計算: 処方日数 × 1日の服用回数（タイミングの数）× 1回あたりの服薬数
      const totalPills = data.prescriptionDays * data.frequency.length * data.dosagePerTime

      await addDoc(collection(db, "medications"), {
        userId: user.uid,
        name: data.name,
        dosagePerTime: data.dosagePerTime,
        frequency: data.frequency,
        prescriptionDays: data.prescriptionDays,
        totalPills: totalPills,
        remainingPills: totalPills, // 初期値は総数と同じ
        notes: data.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        takenCount: 0, // 服用回数の初期値
      })

      toast({
        title: "お薬を追加しました",
        description: `${data.name}が正常に追加されました`,
      })

      router.push("/medications")
    } catch (error) {
      console.error("お薬の追加に失敗しました:", error)
      toast({
        title: "エラー",
        description: "お薬の追加に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mr-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">お薬を追加</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>お薬情報</CardTitle>
          <CardDescription>新しいお薬の情報を入力してください</CardDescription>
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

