"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { PlusCircle, Edit, Trash2, PlusSquare, Check, Users } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
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
  createdAt: any
}

export default function MedicationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [medicationToDelete, setMedicationToDelete] = useState<string | null>(null)
  const [medicationToAddDays, setMedicationToAddDays] = useState<Medication | null>(null)
  const [additionalDays, setAdditionalDays] = useState<number>(14)
  const [medicationToTake, setMedicationToTake] = useState<Medication | null>(null)
  const [selectedTiming, setSelectedTiming] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [isParentalView, setIsParentalView] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    setSelectedUserId(user.uid)
  }, [user])

  useEffect(() => {
    if (!user || !db || !selectedUserId) return

    const fetchMedications = async () => {
      setLoading(true)
      try {
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
          const dateA = a.createdAt
            ? a.createdAt.toDate
              ? a.createdAt.toDate().getTime()
              : new Date(a.createdAt).getTime()
            : 0
          const dateB = b.createdAt
            ? b.createdAt.toDate
              ? b.createdAt.toDate().getTime()
              : new Date(b.createdAt).getTime()
            : 0
          return dateB - dateA
        })

        setMedications(validatedMedications)

        // ペアレンタルビューかどうかを設定
        setIsParentalView(selectedUserId !== user.uid)
      } catch (error) {
        console.error("お薬データの取得に失敗しました:", error)
        toast({
          title: "エラー",
          description: "お薬データの取得に失敗しました",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchMedications()
  }, [user, db, selectedUserId])

  const handleAddMedication = () => {
    router.push("/medications/add")
  }

  const handleEditMedication = (id: string) => {
    router.push(`/medications/edit/${id}`)
  }

  const handleDeleteMedication = async (e) => {
    if (!medicationToDelete || !db || !user) {
      console.log("削除に必要な情報が不足しています", { medicationToDelete, db, user })
      return
    }

    e?.preventDefault()
    setIsDeleting(true)
    let recordsDeleted = false
    let recordsError = null

    try {
      console.log(`削除を開始: ${medicationToDelete}`)

      // まず薬自体を削除
      await deleteDoc(doc(db, "medications", medicationToDelete))
      console.log("薬の削除完了")

      // 次に関連する服薬記録を削除
      try {
        const recordsQuery = query(collection(db, "medicationRecords"), where("medicationId", "==", medicationToDelete))
        const recordsSnapshot = await getDocs(recordsQuery)
        console.log(`関連する服薬記録: ${recordsSnapshot.size}件`)

        if (recordsSnapshot.size > 0) {
          // 少数の記録の場合は個別に削除
          if (recordsSnapshot.size <= 20) {
            for (const docSnapshot of recordsSnapshot.docs) {
              try {
                await deleteDoc(doc(db, "medicationRecords", docSnapshot.id))
              } catch (individualError) {
                console.error(`記録 ${docSnapshot.id} の削除に失敗:`, individualError)
                // 個別のエラーは無視して続行
              }
            }
          } else {
            // 多数の記録の場合はバッチ処理を使用
            // Firestoreのバッチ処理は最大500件まで
            const batches = []
            let currentBatch = writeBatch(db)
            let operationCount = 0

            recordsSnapshot.docs.forEach((docSnapshot) => {
              currentBatch.delete(doc(db, "medicationRecords", docSnapshot.id))
              operationCount++

              // 500件ごとに新しいバッチを作成
              if (operationCount === 500) {
                batches.push(currentBatch)
                currentBatch = writeBatch(db)
                operationCount = 0
              }
            })

            // 残りのオペレーションがあれば、最後のバッチに追加
            if (operationCount > 0) {
              batches.push(currentBatch)
            }

            // すべてのバッチを実行
            for (const batch of batches) {
              try {
                await batch.commit()
              } catch (batchError) {
                console.error("バッチ処理中にエラー:", batchError)
                // バッチエラーは記録して続行
              }
            }
          }
        }

        recordsDeleted = true
        console.log("関連する服薬記録の削除完了")
      } catch (recordError) {
        console.error("服薬記録の削除中にエラー:", recordError)
        recordsError = recordError
        // 記録の削除に失敗しても続行
      }

      // 状態を更新
      setMedications(medications.filter((med) => med.id !== medicationToDelete))

      // 成功メッセージを表示（記録削除の結果に応じて）
      if (recordsDeleted) {
        toast({
          title: "削除完了",
          description: "お薬とその記録が削除されました",
        })
      } else {
        toast({
          title: "一部削除完了",
          description: "お薬は削除されましたが、記録の削除に失敗しました",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("お薬の削除に失敗しました:", error)
      // エラーの詳細情報を出力
      if (error instanceof Error) {
        console.error("エラー詳細:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
      }

      toast({
        title: "エラー",
        description: "お薬の削除に失敗しました: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setMedicationToDelete(null)
      setIsDeleting(false)
    }
  }

  const handleAddPrescriptionDays = async () => {
    if (!medicationToAddDays || !db || additionalDays <= 0) return

    try {
      // 追加の総錠数を計算
      const additionalPills = additionalDays * medicationToAddDays.frequency.length * medicationToAddDays.dosagePerTime

      // 新しい総錠数と残数を計算
      const newTotalPills = medicationToAddDays.totalPills + additionalPills
      const newRemainingPills = medicationToAddDays.remainingPills + additionalPills
      const newPrescriptionDays = medicationToAddDays.prescriptionDays + additionalDays

      await updateDoc(doc(db, "medications", medicationToAddDays.id), {
        prescriptionDays: newPrescriptionDays,
        totalPills: newTotalPills,
        remainingPills: newRemainingPills,
        updatedAt: serverTimestamp(),
      })

      // ローカルの状態を更新
      setMedications(
        medications.map((med) =>
          med.id === medicationToAddDays.id
            ? {
                ...med,
                prescriptionDays: newPrescriptionDays,
                totalPills: newTotalPills,
                remainingPills: newRemainingPills,
              }
            : med,
        ),
      )

      toast({
        title: "処方日数を追加しました",
        description: `${medicationToAddDays.name}に${additionalDays}日分が追加されました`,
      })
    } catch (error) {
      console.error("処方日数の追加に失敗しました:", error)
      toast({
        title: "エラー",
        description: "処方日数の追加に失敗しました",
        variant: "destructive",
      })
    } finally {
      setMedicationToAddDays(null)
      setAdditionalDays(14) // リセット
    }
  }

  const handleTakeMedication = async () => {
    if (!medicationToTake || !selectedTiming || !db || !user) return

    try {
      const now = new Date()
      const formattedTime = format(now, "HH:mm", { locale: ja })

      // 服薬記録を追加
      await addDoc(collection(db, "medicationRecords"), {
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
        <h1 className="text-3xl font-bold tracking-tight">お薬管理</h1>
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

      {medications.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medications.map((medication) => (
            <Card key={medication.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{medication.name}</span>
                  {medication.remainingPills < 10 && (
                    <Badge variant="destructive" className="ml-2">
                      残りわずか
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {medication.dosagePerTime} 錠/回 - {medication.prescriptionDays} 日分
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {medication.frequency.map((freq) => (
                      <Badge key={freq} variant="outline">
                        {freq}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">残り錠数:</span>
                      <span className={medication.remainingPills < 10 ? "text-red-600 font-bold" : ""}>
                        {medication.remainingPills} 錠
                      </span>
                    </div>
                  </div>
                  {medication.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>メモ: {medication.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <div className="flex justify-between w-full">
                  {!isParentalView ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleEditMedication(medication.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => router.push(`/medications/${medication.id}/delete`)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        削除
                      </Button>
                    </>
                  ) : (
                    <div className="w-full">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => setMedicationToTake(medication)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            服用を記録
                          </Button>
                        </DialogTrigger>
                        <DialogContent key={medication.id + "take"}>
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
                    </div>
                  )}
                </div>
                {!isParentalView && (
                  <div className="flex justify-between w-full mt-2">
                    {/* 処方日数追加ボタン */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setMedicationToAddDays(medication)}>
                          <PlusSquare className="h-4 w-4 mr-2" />
                          処方追加
                        </Button>
                      </DialogTrigger>
                      <DialogContent key={medication.id + "addDays"}>
                        <DialogHeader>
                          <DialogTitle>処方日数の追加</DialogTitle>
                          <DialogDescription>{medication.name}の処方日数を追加します。</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="additionalDays" className="text-right">
                              追加日数
                            </Label>
                            <Input
                              id="additionalDays"
                              type="number"
                              min="1"
                              value={additionalDays}
                              onChange={(e) => setAdditionalDays(Number.parseInt(e.target.value) || 0)}
                              className="col-span-3"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddPrescriptionDays}>追加する</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* 服薬記録ボタン */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="default" size="sm" onClick={() => setMedicationToTake(medication)}>
                          <Check className="h-4 w-4 mr-2" />
                          服用
                        </Button>
                      </DialogTrigger>
                      <DialogContent key={medication.id + "take-non-parental"}>
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
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-3 mb-4">
              <PlusCircle className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">お薬が登録されていません</h3>
            <p className="text-muted-foreground text-center mb-6">
              {isParentalView
                ? "この連携アカウントにはお薬が登録されていません"
                : "服薬管理を始めるには、お薬を追加してください"}
            </p>
            {!isParentalView && (
              <Button onClick={handleAddMedication}>
                <PlusCircle className="mr-2 h-4 w-4" />
                お薬を追加
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

