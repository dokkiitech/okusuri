"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { doc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { showCentralNotification } from "@/lib/notification.tsx"
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"

export default function DeleteMedicationPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [medication, setMedication] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    if (!user || !params.id || !db || loadingParentalCheck || isParentAccount) return

    const fetchMedication = async () => {
      try {
        const medicationDoc = await getDoc(doc(db, "medications", params.id))

        if (medicationDoc.exists()) {
          const medicationData = medicationDoc.data()

          // ユーザーIDが一致するか確認
          if (medicationData.userId !== user.uid) {
            setError("このお薬の削除権限がありません")
            setLoading(false)
            return
          }

          setMedication({
            id: medicationDoc.id,
            ...medicationData,
          })
        } else {
          setError("お薬が見つかりませんでした")
        }
      } catch (error) {
        console.error("お薬データの取得に失敗しました:", error)
        setError("お薬データの取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }

    fetchMedication()
  }, [user, params.id, db, loadingParentalCheck, isParentAccount])

  const handleDelete = async () => {
    if (!medication || !db || !user || isParentAccount) return

    setIsDeleting(true)
    let recordsDeleted = false
    let recordsError = null

    try {
      console.log(`削除を開始: ${medication.id}`)

      // 関連する服薬記録の削除を試みる
      try {
        const recordsQuery = query(collection(db, "medicationRecords"), where("medicationId", "==", medication.id))
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

      // 最後に薬自体を削除
      await deleteDoc(doc(db, "medications", medication.id))
      console.log("薬の削除完了")

      // 成功メッセージを表示（記録削除の結果に応じて）
      if (recordsDeleted) {
        showCentralNotification("削除完了: お薬とその記録が削除されました");
      } else {
        showCentralNotification("一部削除完了: お薬は削除されましたが、記録の削除に失敗しました");
      }

      // 一覧ページにリダイレクト
      router.push("/medications")
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

      setError("お薬の削除に失敗しました: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" />
            エラー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push("/medications")} className="w-full">
            お薬一覧に戻る
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mr-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">お薬を削除</h1>
      </div>

      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">削除の確認</CardTitle>
          <CardDescription>この操作は元に戻せません。本当に「{medication?.name}」を削除しますか？</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <span className="font-medium">お薬名:</span> {medication?.name}
            </p>
            <p>
              <span className="font-medium">用量:</span> {medication?.dosagePerTime}錠/回
            </p>
            <p>
              <span className="font-medium">服用タイミング:</span> {medication?.frequency?.join(", ")}
            </p>
            {medication?.notes && (
              <p>
                <span className="font-medium">メモ:</span> {medication.notes}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                削除中...
              </>
            ) : (
              "削除する"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

