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
import { useLoading } from "@/contexts/loading-context";


export default function DeleteMedicationPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [medication, setMedication] = useState<any>(null)
  const { setLoading } = useLoading();
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !params.id || !db) return;
    setLoading(true);
    const fetchAndAuthorizeMedication = async () => {
      try {
        const medicationDoc = await getDoc(doc(db, "medications", params.id))

        if (medicationDoc.exists()) {
          const medicationData = medicationDoc.data()

          // Authorization check
          const isOwner = medicationData.userId === user.uid
          let isAuthorizedParent = false

          if (!isOwner) {
            const userSettingsRef = doc(db, "userSettings", user.uid)
            const userSettingsSnap = await getDoc(userSettingsRef)
            if (userSettingsSnap.exists()) {
              const settings = userSettingsSnap.data()
              if (settings.linkedAccounts && settings.linkedAccounts.includes(medicationData.userId)) {
                isAuthorizedParent = true
              }
            }
          }

          if (isOwner || isAuthorizedParent) {
            setMedication({
              id: medicationDoc.id,
              ...medicationData,
            })
          } else {
            setError("このお薬の削除権限がありません")
          }
        } else {
          setError("お薬が見つかりませんでした")
        }
      } catch (error) {
        console.error("お薬データの取得または権限の確認に失敗しました:", error)
        setError("お薬データの取得に失敗しました")
      } finally {
        setLoading(false);
      }
    }

    fetchAndAuthorizeMedication()
  }, [user, params.id, db, setLoading])

  const handleDelete = async () => {
    if (!medication || !db || !user) return;
    setLoading(true);
    try {
      // 薬自体を削除
      await deleteDoc(doc(db, "medications", medication.id))
      console.log("薬の削除完了")

      showCentralNotification("お薬が削除されました");

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
      setLoading(false);
    }
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

