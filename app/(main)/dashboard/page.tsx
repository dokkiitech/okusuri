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
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { PlusCircle, CheckCircle2, XCircle, Clock, Check, Users, ArrowRight, Pill, CalendarDays, Bell, ChevronRight, ChevronLeft } from 'lucide-react'
import { format, startOfDay, endOfDay, isWithinInterval, addDays, subDays, isToday } from "date-fns"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { showCentralNotification } from "@/lib/notification.tsx"
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
  const [showBulkRecordDialog, setShowBulkRecordDialog] = useState(false)
  const [timingToBulkRecord, setTimingToBulkRecord] = useState<string | null>(null)
  const [openTiming, setOpenTiming] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
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
        const medicationsQuery = query(collection(db, "medications"), where("userId", "==", selectedUserId))
        const medicationsSnapshot = await getDocs(medicationsQuery)
        const medicationsData = medicationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Medication[]

        const validatedMedications = medicationsData.map((med) => ({
          ...med,
          frequency: Array.isArray(med.frequency) ? med.frequency : [],
          dosagePerTime: typeof med.dosagePerTime === "number" ? med.dosagePerTime : 1,
          prescriptionDays: typeof med.prescriptionDays === "number" ? med.prescriptionDays : 0,
          totalPills: typeof med.totalPills === "number" ? med.totalPills : 0,
          remainingPills: typeof med.remainingPills === "number" ? med.remainingPills : 0,
          takenCount: typeof med.takenCount === "number" ? med.takenCount : 0,
        })).sort((a, b) => {
          const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0
          const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0
          return dateB - dateA
        })

        setMedications(validatedMedications)

        const startOfCurrentDate = startOfDay(currentDate)
        const endOfCurrentDate = endOfDay(currentDate)

        const recordsQuery = query(collection(db, "medicationRecords"), where("userId", "==", selectedUserId))
        const recordsSnapshot = await getDocs(recordsQuery)
        const allRecords = recordsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MedicationRecord[]

        const todayRecordsData = allRecords
          .filter((record) => {
            if (!record.createdAt) return false
            const recordDate =
              record.createdAt instanceof Timestamp ? record.createdAt.toDate() : new Date(record.createdAt)

            return isWithinInterval(recordDate, {
              start: startOfCurrentDate,
              end: endOfCurrentDate,
            })
          })
          .sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0
            const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0
            return dateB - dateA
          })

        setTodayRecords(todayRecordsData)

        const totalScheduledDosesToday = validatedMedications.reduce(
          (sum, med) => sum + med.frequency.length,
          0,
        )
        const takenDosesToday = todayRecordsData.filter((record) => record.status === "taken").length

        setProgress(totalScheduledDosesToday > 0 ? Math.round((takenDosesToday / totalScheduledDosesToday) * 100) : 0)
        setIsParentalView(selectedUserId !== user.uid)
      } catch (error) {
        console.error("データの取得に失敗しました:", error)
        setError(error instanceof Error ? error : new Error(String(error)))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, db, selectedUserId, currentDate])

  const handleTakeMedication = async () => {
    if (!medicationToTake || !selectedTiming || !db || !user || isParentalView) return

    try {
      const now = currentDate
      const recordRef = await addDoc(collection(db, "medicationRecords"), {
        userId: selectedUserId,
        medicationId: medicationToTake.id,
        medicationName: medicationToTake.name,
        status: "taken",
        scheduledTime: selectedTiming,
        takenAt: now,
        createdAt: now,
        recordedBy: user.uid,
      })

      const newTakenCount = medicationToTake.takenCount + 1
      const newRemainingPills = Math.max(0, medicationToTake.remainingPills - medicationToTake.dosagePerTime)

      await updateDoc(doc(db, "medications", medicationToTake.id), {
        remainingPills: newRemainingPills,
        takenCount: newTakenCount,
        updatedAt: serverTimestamp(),
      })

      const updatedMedications = medications.map((med) =>
        med.id === medicationToTake.id
          ? { ...med, remainingPills: newRemainingPills, takenCount: newTakenCount }
          : med
      )
      setMedications(updatedMedications)

      const newRecord = {
        id: recordRef.id,
        userId: selectedUserId,
        medicationId: medicationToTake.id,
        medicationName: medicationToTake.name,
        status: "taken",
        scheduledTime: selectedTiming,
        takenAt: { toDate: () => now } as Timestamp,
        createdAt: { toDate: () => now } as Timestamp,
      } as MedicationRecord

      const updatedTodayRecords = [newRecord, ...todayRecords]
      setTodayRecords(updatedTodayRecords)

      showCentralNotification(`${medicationToTake.name}を服用しました`);
    } catch (error) {
      console.error("服薬記録の追加に失敗しました:", error)
      showCentralNotification("服薬記録の追加に失敗しました");
    } finally {
      setMedicationToTake(null)
      setSelectedTiming("")
    }
  }

  const handleTakeAllMedicationsForTiming = async (timing: string) => {
    if (!db || !user || isParentalView) return

    setLoading(true)
    try {
      const now = currentDate
      const batch = writeBatch(db)
      const newTodayRecords: MedicationRecord[] = [...todayRecords]
      const updatedMedications = [...medications]

      for (const med of medications) {
        // Check if the medication is scheduled for this timing and hasn't been taken yet today
        const alreadyTaken = todayRecords.some(
          (r) => r.medicationId === med.id && r.scheduledTime === timing && r.status === "taken"
        )

        if (med.frequency.includes(timing) && !alreadyTaken) {
          // Add record to batch
          const recordRef = doc(collection(db, "medicationRecords"))
          batch.set(recordRef, {
            userId: selectedUserId,
            medicationId: med.id,
            medicationName: med.name,
            status: "taken",
            scheduledTime: timing,
            takenAt: now,
            createdAt: now,
            recordedBy: user.uid,
          })

          // Update medication remaining pills and taken count
          const newRemainingPills = Math.max(0, med.remainingPills - med.dosagePerTime)
          const newTakenCount = med.takenCount + 1
          const medRef = doc(db, "medications", med.id)
          batch.update(medRef, {
            remainingPills: newRemainingPills,
            takenCount: newTakenCount,
            updatedAt: serverTimestamp(),
          })

          // 残薬通知のロジック
          const dosesPerDay = med.frequency.length * med.dosagePerTime;
          if (dosesPerDay > 0) {
            const remainingDays = newRemainingPills / dosesPerDay;
            if (remainingDays <= REMAINING_PILLS_THRESHOLD_DAYS) {
              const message = `${med.name}の残りが少なくなっています。残り約${Math.ceil(remainingDays)}日分です。`;
              showCentralNotification(message);
              sendPushNotification(user.uid, "残薬が少なくなっています", message);
              // LINE連携しているユーザーにはLINEでも通知
              if (user.lineUid) {
                sendLineMessage(user.lineUid, message);
              }
            }
          }

          // Update local state for todayRecords
          newTodayRecords.push({
            id: recordRef.id,
            userId: selectedUserId,
            medicationId: med.id,
            medicationName: med.name,
            status: "taken",
            scheduledTime: timing,
            takenAt: { toDate: () => now } as Timestamp,
            createdAt: { toDate: () => now } as Timestamp,
          } as MedicationRecord)

          // Update local state for medications
          const medIndex = updatedMedications.findIndex((m) => m.id === med.id)
          if (medIndex > -1) {
            updatedMedications[medIndex] = {
              ...updatedMedications[medIndex],
              remainingPills: newRemainingPills,
              takenCount: newTakenCount,
            }
          }
        }
      }

      await batch.commit()

      setTodayRecords(newTodayRecords)
      setMedications(updatedMedications)

      const totalScheduledDoses = updatedMedications.reduce(
        (sum, med) => sum + (Array.isArray(med.frequency) ? med.frequency.length : 0),
        0
      )
      const takenDoses = newTodayRecords.filter((record) => record.status === "taken").length
      setProgress(totalScheduledDoses > 0 ? Math.round((takenDoses / totalScheduledDoses) * 100) : 0)

      showCentralNotification(`${timing}のすべてのお薬を服用済みとして記録しました`);
    } catch (error) {
      console.error("服薬の一括記録に失敗しました:", error)
      showCentralNotification("服薬の一括記録に失敗しました");
    } finally {
      setTimingToBulkRecord(null)
      setLoading(false)
    }
  }

  const previousDay = () => {
    setCurrentDate(subDays(currentDate, 1))
  }

  const nextDay = () => {
    setCurrentDate(addDays(currentDate, 1))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
      </div>
    )
  }

  const formattedDate = format(currentDate, "M月d日 (eee)", { locale: ja })

  const upcomingSchedules = ["朝", "昼", "晩", "就寝前"].map(timing => {
    const meds = medications.filter(med => med.frequency.includes(timing) && !todayRecords.some(r => r.medicationId === med.id && r.scheduledTime === timing && r.status === 'taken'))
    return { timing, meds, count: meds.length }
  }).filter(s => s.count > 0)

  return (
    <div className="space-y-8">
      <ErrorHandler error={error} resetError={resetError} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">こんにちは、{user?.displayName || 'ユーザー'}さん</h1>
          <p className="text-muted-foreground">今日も一日、お薬の管理を頑張りましょう！</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountSwitcher currentUserId={selectedUserId} onAccountChange={setSelectedUserId} />
          {!isParentalView && (
            <Button onClick={() => router.push('/medications/add')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              お薬を追加
            </Button>
          )}
        </div>
      </div>

      {isParentalView && (
        <Card className="bg-blue-950/30 border-blue-800/50">
          <CardContent className="p-4 flex items-center">
            <Users className="h-5 w-5 mr-3 text-blue-400" />
            <p className="text-blue-300">
              ペアレンタルコントロールモード - 連携アカウントの服薬状況を表示しています
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              <span>{isToday(currentDate) ? "今日の服薬状況" : `${formattedDate}の服薬状況`}</span>
              
              <div className="flex items-center space-x-2 ml-auto">
                
                <Button variant="outline" size="icon" onClick={previousDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={nextDay} disabled={isToday(currentDate)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
            <CardDescription>今日の服薬の進捗状況です</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center gap-6">
                <div className="relative h-32 w-32">
                    <svg className="h-full w-full" viewBox="0 0 36 36">
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="hsl(var(--secondary))"
                            strokeWidth="3"
                        />
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="3"
                            strokeDasharray={`${progress}, 100`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold">{progress}%</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span>服用済み: {todayRecords.filter(r => r.status === 'taken').length} 件</span>
                    </div>
                    <div className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <span>未服用: {medications.reduce((acc, med) => acc + med.frequency.length, 0) - todayRecords.filter(r => r.status === 'taken').length} 件</span>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-6 w-6" />
              <span>次の服薬予定</span>
            </CardTitle>
             <CardDescription>時間になったら通知が届きます</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingSchedules.length > 0 ? (
              <div className="space-y-3">
                {upcomingSchedules.map(({ timing, meds, count }) => (
                  <Collapsible
                    key={timing}
                    open={openTiming === timing}
                    onOpenChange={() => setOpenTiming(openTiming === timing ? null : timing)}
                    className="rounded-lg border bg-secondary data-[state=open]:bg-secondary/50"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-3">
                      <div className="font-semibold text-lg">{timing}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">{count} 件のお薬</div>
                        <ChevronRight className={cn("h-4 w-4 transition-transform", openTiming === timing && "rotate-90")} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 p-3 pt-0">
                      {meds.map((med) => (
                        <div key={med.id} className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <div className="font-medium">{med.name}</div>
                            <div className="text-sm text-muted-foreground">
                              1回{med.dosagePerTime}錠
                            </div>
                          </div>
                          {!isParentalView && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setMedicationToTake(med)
                                    setSelectedTiming(timing)
                                  }}
                                >
                                  服用を記録
                                </Button>
                              </DialogTrigger>
                              {medicationToTake?.id === med.id && selectedTiming === timing && (
                                <DialogContent key={med.id + timing}>
                                  <DialogHeader>
                                    <DialogTitle>服薬記録</DialogTitle>
                                    <DialogDescription>
                                      {med.name}を{timing}に服用したことを記録しますか？
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setMedicationToTake(null)}>
                                      キャンセル
                                    </Button>
                                    <Button onClick={handleTakeMedication}>
                                      記録
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              )}
                            </Dialog>
                          )}
                        </div>
                      ))}
                      {!isParentalView && (
                        <Dialog open={timingToBulkRecord === timing} onOpenChange={(open) => {
                          if (open) {
                            setTimingToBulkRecord(timing)
                          } else {
                            setTimingToBulkRecord(null)
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full mt-2">
                              一括で記録
                            </Button>
                          </DialogTrigger>
                          {timingToBulkRecord === timing && (
                            <DialogContent key={timing}>
                              <DialogHeader>
                                <DialogTitle>{timing}の服薬をまとめて記録しますか？</DialogTitle>
                                <DialogDescription>
                                  {timing}に服用予定のすべてのお薬（{count}件）を「服用済み」として記録します。
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setTimingToBulkRecord(null)}>
                                  キャンセル
                                </Button>
                                <Button onClick={() => handleTakeAllMedicationsForTiming(timing)}>
                                  まとめて記録
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          )}
                        </Dialog>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">今日の服薬予定はすべて完了しました</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-6 w-6" />
            <span>お薬一覧</span>
          </CardTitle>
          <CardDescription>登録されているお薬のリストです</CardDescription>
        </CardHeader>
        <CardContent>
          {medications.length > 0 ? (
            <div className="space-y-4">
              {medications.map((med) => (
                <div key={med.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="font-bold text-lg">{med.name}</div>
                    <div className="text-sm text-muted-foreground">
                      1回{med.dosagePerTime}錠 / 残り{med.remainingPills}錠
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => router.push(`/medications/edit/${med.id}`)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">登録されているお薬はありません</p>
              {!isParentalView && (
                <Button onClick={() => router.push('/medications/add')}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  お薬を追加する
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
