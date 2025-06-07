"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { PlusCircle, CheckCircle2, XCircle, Clock, Check, Users } from 'lucide-react'
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns"
import { ja } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { AccountSwitcher } from "@/components/account-switcher"
import { ErrorHandler } from "@/components/error-handler"

interface Medication {
  id: string
  userId: string
  name: string
  dosagePerTime: number
  frequency: string[]
  prescriptionDays: number
  totalPills: number
  remainingPills: number
  notes?: string
  takenCount: number
  createdAt: Timestamp
}

interface MedicationRecord {
  id: string
  userId: string
  medicationId: string
  medicationName: string
  status: "taken" | "skipped" | "pending"
  scheduledTime: string
  takenAt?: Timestamp
  createdAt: Timestamp
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [medications, setMedications] = useState<Medication[]>([])
  const [todayRecords, setTodayRecords] = useState<MedicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [medicationToTake, setMedicationToTake] = useState<Medication | null>(null)
  const [selectedTiming, setSelectedTiming] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [isParentalView, setIsParentalView] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const resetError = () => setError(null)

  useEffect(() => {
    if (!user) return
    setSelectedUserId(user.uid)
  }, [user])

  useEffect(() => {
    if (!user || !db || !selectedUserId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // 薬の情報を取得
        const medicationsQuery = query(collection(db, "medications"), where("userId", "==", selectedUserId))
        const medicationsSnapshot = await getDocs(medicationsQuery)
        const medicationsData = medicationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Medication[]

        // データの検証と安全性確保
        const validatedMedications = medicationsData.map((med) => ({
          ...med,
          frequency: Array.isArray(med.frequency) ? med.frequency : [],
          dosagePerTime: typeof med.dosagePerTime === "number" ? med.dosagePerTime : 1,
          prescriptionDays: typeof med.prescriptionDays === "number" ? med.prescriptionDays : 0,
          totalPills: typeof med.totalPills === "number" ? med.totalPills : 0,
          remainingPills: typeof med.remainingPills === "number" ? med.remainingPills : 0,
          takenCount: typeof med.takenCount === "number" ? med.takenCount : 0,
        }))

        // 作成日でソート（降順）
        validatedMedications.sort((a, b) => {
          const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0
          const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0
          return dateB - dateA
        })

        setMedications(validatedMedications)

        // 今日の服薬記録を取得
        const today = new Date()
        const startOfToday = startOfDay(today)
        const endOfToday = endOfDay(today)

        // 選択されたユーザーIDで服薬記録を取得
        const recordsQuery = query(collection(db, "medicationRecords"), where("userId", "==", selectedUserId))

        const recordsSnapshot = await getDocs(recordsQuery)
        const allRecords = recordsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MedicationRecord[]

        // クライアント側で今日のレコードをフィルタリングとソート
        const todayRecordsData = allRecords
          .filter((record) => {
            if (!record.createdAt) return false
            const recordDate =
              record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date(record.createdAt)

            return isWithinInterval(recordDate, {
              start: startOfToday,
              end: endOfToday,
            })
          })
          .sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0
            const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0
            return dateB - dateA
          })

        setTodayRecords(todayRecordsData)

        // 進捗状況を計算
        const totalScheduledDosesToday = validatedMedications.reduce(
          (sum, med) => sum + (Array.isArray(med.frequency) ? med.frequency.length : 0),
          0,
        )
        const takenDosesToday = todayRecordsData.filter((record) => record.status === "taken").length

        if (totalScheduledDosesToday > 0) {
          setProgress(Math.round((takenDosesToday / totalScheduledDosesToday) * 100))
        } else {
          setProgress(0)
        }

        // ペアレンタルビューかどうかを設定
        setIsParentalView(selectedUserId !== user.uid)
      } catch (error) {
        console.error("データの取得に失敗しました:", error)
        setError(error instanceof Error ? error : new Error(String(error)))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, db, selectedUserId])

  const handleAddMedication = () => {
    router.push("/medications/add")
  }

  const handleTakeMedication = async () => {
    if (!medicationToTake || !selectedTiming || !db || !user) return

    // ペアレンタルモードでの服薬記録を禁止
    if (isParentalView) {
      toast({
        title: "権限エラー",
        description: "ペアレンタルコントロールモードでは服薬記録を追加できません",
        variant: "destructive",
      })
      return
    }

    try {
      const now = new Date()
      const formattedTime = format(now, "HH:mm", { locale: ja })

      // 服薬記録を追加
      const recordRef = await addDoc(collection(db, "medicationRecords"), {
        userId: selectedUserId,
        medicationId: medicationToTake.id,
        medicationName: medicationToTake.name,
        status: "taken",
        scheduledTime: selectedTiming,
        takenAt: now,
        createdAt: now,
        recordedBy: user.uid, // 誰が記録したかを保存
      })

      // 残数と服用回数を更新
      const newTakenCount = medicationToTake.takenCount + 1
      const newRemainingPills = Math.max(0, medicationToTake.remainingPills - medicationToTake.dosagePerTime)

      await updateDoc(doc(db, "medications", medicationToTake.id), {
        remainingPills: newRemainingPills,
        takenCount: newTakenCount,
        updatedAt: serverTimestamp(),
      })

      // ローカルの状態を更新
      setMedications(
        medications.map((med) =>
          med.id === medicationToTake.id
            ? {
                ...med,
                remainingPills: newRemainingPills,
                takenCount: newTakenCount,
              }
            : med,
        ),
      )

      // 今日の記録に追加
      const newRecord = {
        id: recordRef.id,
        userId: selectedUserId,
        medicationId: medicationToTake.id,
        medicationName: medicationToTake.name,
        status: "taken",
        scheduledTime: selectedTiming,
        takenAt: { toDate: () => now } as Timestamp,
        createdAt: { toDate: () => now } as Timestamp,
        recordedBy: user.uid,
      }

      setTodayRecords([newRecord, ...todayRecords])

      // 進捗状況を更新
      const totalScheduledDoses = medications.reduce(
        (sum, med) => sum + (Array.isArray(med.frequency) ? med.frequency.length : 0),
        0,
      )
      const updatedTodayRecords = [newRecord, ...todayRecords]
      const takenDoses = updatedTodayRecords.filter((record) => record.status === "taken").length

      if (totalScheduledDoses > 0) {
        setProgress(Math.round((takenDoses / totalScheduledDoses) * 100))
      } else {
        setProgress(0)
      }

      toast({
        title: "服薬を記録しました",
        description: `${medicationToTake.name}を服用しました`,
      })
    } catch (error) {
      console.error("服薬記録の追加に失敗しました:", error)
      toast({
        title: "エラー",
        description: "服薬記録の追加に失敗しました",
        variant: "destructive",
      })
    } finally {
      setMedicationToTake(null)
      setSelectedTiming("")
    }
  }

  const handleAccountChange = (userId: string) => {
    setSelectedUserId(userId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const today = new Date()
  const formattedDate = format(today, "yyyy年MM月dd日 (eee)", { locale: ja })

  return (
    <div className="space-y-6">
      <ErrorHandler error={error} resetError={resetError} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          {!isParentalView && (
            <Button onClick={handleAddMedication}>
              <PlusCircle className="mr-2 h-4 w-4" />
              お薬を追加
            </Button>
          )}
          <AccountSwitcher currentUserId={selectedUserId} onAccountChange={handleAccountChange} />
        </div>
      </div>

      {isParentalView && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <p className="text-blue-700 dark:text-blue-300">
              ペアレンタルコントロールモード - 連携アカウントの服薬状況を表示しています
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{formattedDate}</CardTitle>
          <CardDescription>今日の服薬状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進捗状況</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {todayRecords.length > 0 ? (
              <div className="space-y-4">
                {todayRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{record.medicationName || "無名の薬"}</div>
                      <div className="text-sm text-muted-foreground">{record.scheduledTime || "時間未設定"}</div>
                    </div>
                    <div>
                      {record.status === "taken" ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle2 className="h-5 w-5 mr-1" />
                          <span className="text-sm">服用済み</span>
                        </div>
                      ) : record.status === "skipped" ? (
                        <div className="flex items-center text-red-600">
                          <XCircle className="h-5 w-5 mr-1" />
                          <span className="text-sm">スキップ</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-amber-600">
                          <Clock className="h-5 w-5 mr-1" />
                          <span className="text-sm">未服用</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">今日の服薬記録はありません</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>お薬一覧</CardTitle>
            <CardDescription>登録されているお薬</CardDescription>
          </CardHeader>
          <CardContent>
            {medications.length > 0 ? (
              <div className="space-y-4">
                {medications.map((medication) => (
                  <div key={medication.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{medication.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {medication.dosagePerTime}錠/回 - {medication.prescriptionDays}日分
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">
                        残り:{" "}
                        <span className={medication.remainingPills < 10 ? "text-red-600 font-bold" : ""}>
                          {medication.remainingPills}錠
                        </span>
                      </div>
                      {!isParentalView && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMedicationToTake(medication)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>服薬記録</DialogTitle>
                              <DialogDescription>
                                {medication.name}を服用したタイミングを選択してください。
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-2 gap-2">
                                {medication.frequency.map((timing) => (
                                  <Button
                                    key={timing}
                                    variant={selectedTiming === timing ? "default" : "outline"}
                                    onClick={() => setSelectedTiming(timing)}
                                    className="w-full"
                                  >
                                    {timing}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleTakeMedication} disabled={!selectedTiming}>
                                服用を記録
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                登録されているお薬はありません
                {!isParentalView && (
                  <div className="mt-4">
                    <Button onClick={handleAddMedication}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      お薬を追加
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日の予定</CardTitle>
            <CardDescription>服薬スケジュール</CardDescription>
          </CardHeader>
          <CardContent>
            {medications.length > 0 ? (
              <div className="space-y-4">
                {["朝", "昼", "晩", "就寝前"].map((timing) => {
                  // Array.includesを安全に使用するために、frequencyが配列であることを確認
                  const timingMeds = medications.filter(
                    (med) => Array.isArray(med.frequency) && med.frequency.includes(timing),
                  )
                  return timingMeds.length > 0 ? (
                    <div key={timing} className="space-y-2">
                      <h3 className="font-medium">{timing}</h3>
                      {timingMeds.map((med) => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-2 border-l-4 border-primary pl-3 rounded-sm"
                        >
                          <div>
                            {med.name} - {med.dosagePerTime}錠
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMedicationToTake(med)
                                  setSelectedTiming(timing)
                                }}
                                disabled={isParentalView} // ペアレンタルモードでは無効化
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>服薬記録</DialogTitle>
                                <DialogDescription>
                                  {med.name}を{timing}に服用しますか？
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button onClick={handleTakeMedication}>服用を記録</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ))}
                    </div>
                  ) : null
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">服薬スケジュールはありません</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
