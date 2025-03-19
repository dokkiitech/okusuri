"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, Users } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isWithinInterval,
} from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
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

export default function CalendarPage() {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [records, setRecords] = useState<MedicationRecord[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [medicationToTake, setMedicationToTake] = useState<Medication | null>(null)
  const [selectedTiming, setSelectedTiming] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [isParentalView, setIsParentalView] = useState(false)

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

        setMedications(validatedMedications)

        // 月の服薬記録を取得
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(currentMonth)

        // 選択されたユーザーIDで服薬記録を取得（orderByなし）
        const recordsQuery = query(collection(db, "medicationRecords"), where("userId", "==", selectedUserId))

        const recordsSnapshot = await getDocs(recordsQuery)
        const allRecords = recordsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        // クライアント側で月のレコードをフィルタリング
        const monthRecords = allRecords.filter((record) => {
          if (!record.createdAt) return false
          const recordDate =
            record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date(record.createdAt)

          return isWithinInterval(recordDate, {
            start: start,
            end: end,
          })
        }) as MedicationRecord[]

        setRecords(monthRecords)

        // ペアレンタルビューかどうかを設定
        setIsParentalView(selectedUserId !== user.uid)
      } catch (error) {
        console.error("データの取得に失敗しました:", error)
        toast({
          title: "エラー",
          description: "カレンダーデータの取得に失敗しました",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, currentMonth, db, selectedUserId])

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  // 日付ごとの服薬状況を集計
  const getDayStatus = (day: Date) => {
    const dayRecords = records.filter((record) => {
      if (!record.createdAt) return false

      // Timestamp型かどうかをチェック
      const recordDate = record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date(record.createdAt)

      return isSameDay(recordDate, day)
    })

    if (dayRecords.length === 0) return null

    const takenCount = dayRecords.filter((record) => record.status === "taken").length
    const totalCount = dayRecords.length

    if (takenCount === totalCount) return "complete"
    if (takenCount > 0) return "partial"
    return "missed"
  }

  // 日付ごとの服薬記録を取得
  const getDayRecords = (day: Date) => {
    return records.filter((record) => {
      if (!record.createdAt) return false

      // Timestamp型かどうかをチェック
      const recordDate = record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date(record.createdAt)

      return isSameDay(recordDate, day)
    })
  }

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
  }

  const handleTakeMedication = async () => {
    if (!medicationToTake || !selectedTiming || !db || !user || !selectedDay) return

    try {
      const now = selectedDay

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

      // 新しい記録を追加
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

      setRecords([...records, newRecord])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">服薬カレンダー</h1>
        <AccountSwitcher currentUserId={selectedUserId} onAccountChange={handleAccountChange} />
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
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>{format(currentMonth, "yyyy年MM月", { locale: ja })}</CardTitle>
            <CardDescription>服薬記録カレンダー</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
              <div key={day} className="text-center font-medium py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 border rounded-md bg-muted/20"></div>
            ))}
            {days.map((day) => {
              const status = getDayStatus(day)
              const dayRecords = getDayRecords(day)
              const isSelected = selectedDay && isSameDay(day, selectedDay)

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "h-24 border rounded-md p-1 overflow-hidden cursor-pointer transition-colors",
                    !isSameMonth(day, currentMonth) && "bg-muted/20",
                    isToday(day) && "border-primary border-2",
                    isSelected && "ring-2 ring-primary",
                    status === "complete" && "bg-green-50 dark:bg-green-950/20",
                    status === "partial" && "bg-amber-50 dark:bg-amber-950/20",
                    status === "missed" && "bg-red-50 dark:bg-red-950/20",
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="text-right text-sm font-medium">{format(day, "d")}</div>
                  <div className="mt-1 space-y-1 overflow-y-auto max-h-[calc(100%-20px)]">
                    {dayRecords.map((record) => (
                      <div key={record.id} className="text-xs flex items-center truncate">
                        {record.status === "taken" ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600 mr-1 flex-shrink-0" />
                        ) : record.status === "skipped" ? (
                          <XCircle className="h-3 w-3 text-red-600 mr-1 flex-shrink-0" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-600 mr-1 flex-shrink-0" />
                        )}
                        <span className="truncate">{record.medicationName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle>{format(selectedDay, "yyyy年MM月dd日 (eee)", { locale: ja })}</CardTitle>
            <CardDescription>この日の服薬記録</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getDayRecords(selectedDay).length > 0 ? (
                <div className="space-y-2">
                  {getDayRecords(selectedDay).map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{record.medicationName}</div>
                        <div className="text-sm text-muted-foreground">{record.scheduledTime}</div>
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
                <div className="text-center py-4 text-muted-foreground">この日の服薬記録はありません</div>
              )}

              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">服薬を記録する</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {medications.map((medication) => (
                    <Dialog key={medication.id}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => setMedicationToTake(medication)}
                        >
                          <span className="truncate">{medication.name}</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>服薬記録</DialogTitle>
                          <DialogDescription>
                            {medication.name}を{format(selectedDay, "yyyy年MM月dd日", { locale: ja })}
                            に服用したタイミングを選択してください。
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
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>凡例</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-50 dark:bg-green-950/20 border rounded mr-2"></div>
              <span>全て服用済み</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-amber-50 dark:bg-amber-950/20 border rounded mr-2"></div>
              <span>一部服用済み</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-50 dark:bg-red-950/20 border rounded mr-2"></div>
              <span>未服用</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

