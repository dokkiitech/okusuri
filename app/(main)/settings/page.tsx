"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { generateLinkCode } from "@/lib/utils"
import { Copy, Unlink } from "lucide-react"
// import { enablePushNotifications } from "@/lib/push-notification";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const reminderFormSchema = z.object({
  朝: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  昼: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  晩: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  就寝前: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  頓服: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください").optional().or(z.literal("")), // 頓服を追加 (オプショナル、空文字許容)
})

const accountFormSchema = z.object({
  displayName: z.string().min(2, "名前は2文字以上である必要があります"),
})

interface LinkedAccount {
  uid: string
  displayName: string
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [lowMedicationAlertsEnabled, setLowMedicationAlertsEnabled] = useState(false)
  const [linkCode, setLinkCode] = useState("")
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [inputLinkCode, setInputLinkCode] = useState("")
  const [accountToUnlink, setAccountToUnlink] = useState<string | null>(null)

  const reminderForm = useForm<z.infer<typeof reminderFormSchema>>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      朝: "08:00",
      昼: "12:00",
      晩: "18:00",
      就寝前: "22:00",
      頓服: "", // 頓服のデフォルト値
    },
  })

  const accountForm = useForm<z.infer<typeof accountFormSchema>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  })

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return

      try {
        // ユーザー設定の取得
        if (!db) {
          console.error("Firestore is not initialized")
          setLoading(false)
          return
        }

        const settingsDoc = await getDoc(doc(db, "userSettings", user.uid))

        if (settingsDoc.exists()) {
          const settings = settingsDoc.data()
          reminderForm.reset({
            朝: settings.reminderTimes?.朝 || "08:00",
            昼: settings.reminderTimes?.昼 || "12:00",
            晩: settings.reminderTimes?.晩 || "18:00",
            就寝前: settings.reminderTimes?.就寝前 || "22:00",
            頓服: settings.reminderTimes?.頓服 || "", // 頓服を追加
          })

          // 連携コードとリンクされたアカウントを設定
          if (settings.linkCode) {
            setLinkCode(settings.linkCode)
          } else {
            // 連携コードがない場合は新しく生成して保存
            const newLinkCode = generateLinkCode()
            setLinkCode(newLinkCode)
            if (!db) {
              console.error("Firestore is not initialized")
              setLoading(false)
              return
            }
            await updateDoc(doc(db, "userSettings", user.uid), {
              linkCode: newLinkCode,
              updatedAt: new Date(),
            })
          }

          // 連携アカウントの詳細情報を取得
          if (settings.linkedAccounts && settings.linkedAccounts.length > 0) {
            const linkedAccountsData: LinkedAccount[] = []

            for (const accountId of settings.linkedAccounts) {
              try {
                if (!db) {
                  console.error("Firestore is not initialized")
                  setLoading(false)
                  return
                }
                const userDoc = await getDoc(doc(db, "users", accountId))
                if (userDoc.exists()) {
                  linkedAccountsData.push({
                    uid: accountId,
                    displayName: userDoc.data().displayName || "名前なし",
                  })
                }
              } catch (error) {
                console.error("連携アカウント情報の取得に失敗しました:", error)
              }
            }

            setLinkedAccounts(linkedAccountsData)
          }

          // 通知設定を初期化
          setNotificationsEnabled(settings.notificationSettings?.reminderNotifications ?? settings.notificationsEnabled ?? false)
          setLowMedicationAlertsEnabled(settings.notificationSettings?.lowMedicationAlerts ?? true)
        } else {
          // 設定がない場合は新しく作成
          const newLinkCode = generateLinkCode()
          setLinkCode(newLinkCode)
          if (!db) {
            console.error("Firestore is not initialized")
            setLoading(false)
            return
          }
          await setDoc(doc(db, "userSettings", user.uid), {
            userId: user.uid,
            reminderTimes: {
              朝: "08:00",
              昼: "12:00",
              晩: "18:00",
              就寝前: "22:00",
              頓服: "", // 頓服を追加
            },
            linkCode: newLinkCode,
            linkedAccounts: [],
            notificationsEnabled: false,
            notificationSettings: {
              reminderNotifications: false,
              lowMedicationAlerts: true,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        // 表示名を設定
        accountForm.reset({
          displayName: user.displayName || "",
        })
      } catch (error) {
        console.error("設定の取得に失敗しました:", error)
        toast({
          title: "エラー",
          description: "設定の取得に失敗しました",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [user, reminderForm, accountForm, db])

  async function onReminderSubmit(values: z.infer<typeof reminderFormSchema>) {
    if (!user) return

    setIsSubmitting(true)
    try {
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      const reminderData = {
        ...values,
        頓服: values.頓服 || "", // 空文字の場合は空文字として保存
      }
      await updateDoc(doc(db, "userSettings", user.uid), {
        reminderTimes: reminderData,
        updatedAt: new Date(),
      })

      toast({
        title: "設定を保存しました",
        description: "リマインダー時間が更新されました",
      })
    } catch (error) {
      console.error("設定の保存に失敗しました:", error)
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onAccountSubmit(values: z.infer<typeof accountFormSchema>) {
    if (!user) return

    setIsSubmitting(true)
    try {
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      await updateDoc(doc(db, "users", user.uid), {
        displayName: values.displayName,
        updatedAt: new Date(),
      })

      toast({
        title: "設定を保存しました",
        description: "アカウント情報が更新されました",
      })
    } catch (error) {
      console.error("設定の保存に失敗しました:", error)
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLinkCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !inputLinkCode || inputLinkCode.length < 5) return

    setIsSubmitting(true)
    try {
      // 入力された連携コードでユーザー設定を検索
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      const settingsQuery = query(collection(db, "userSettings"), where("linkCode", "==", inputLinkCode))

      const settingsSnapshot = await getDocs(settingsQuery)

      if (settingsSnapshot.empty) {
        toast({
          title: "連携コードが見つかりません",
          description: "入力された連携コードに一致するユーザーが見つかりませんでした",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // 見つかったユーザー設定
      const targetSettingsDoc = settingsSnapshot.docs[0]
      const targetUserId = targetSettingsDoc.data().userId

      // 自分自身との連携は防止
      if (targetUserId === user.uid) {
        toast({
          title: "連携できません",
          description: "自分自身との連携はできません",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // 既に連携済みかチェック
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      const mySettingsDoc = await getDoc(doc(db, "userSettings", user.uid))

      if (!mySettingsDoc.exists()) {
        toast({
          title: "エラー",
          description: "ユーザー設定が見つかりません",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const mySettings = mySettingsDoc.data()
      const myLinkedAccounts = mySettings.linkedAccounts || []

      if (myLinkedAccounts.includes(targetUserId)) {
        toast({
          title: "既に連携済みです",
          description: "このユーザーとは既に連携しています",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      // 相手のユーザー情報を取得
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      const targetUserDoc = await getDoc(doc(db, "users", targetUserId))
      if (!targetUserDoc.exists()) {
        toast({
          title: "ユーザーが見つかりません",
          description: "連携先のユーザー情報が見つかりませんでした",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const targetUserData = targetUserDoc.data()

      // 相互に連携情報を更新
      // 1. 自分の設定に相手のIDを追加
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      await updateDoc(doc(db, "userSettings", user.uid), {
        linkedAccounts: [...myLinkedAccounts, targetUserId],
        updatedAt: new Date(),
      })

      // 2. 相手の設定に自分のIDを追加
      const targetLinkedAccounts = targetSettingsDoc.data().linkedAccounts || []
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      await updateDoc(doc(db, "userSettings", targetUserId), {
        linkedAccounts: [...targetLinkedAccounts, user.uid],
        updatedAt: new Date(),
      })

      // 連携アカウントリストを更新
      setLinkedAccounts([
        ...linkedAccounts,
        {
          uid: targetUserId,
          displayName: targetUserData.displayName || "名前なし",
        },
      ])

      toast({
        title: "連携しました",
        description: `${targetUserData.displayName || "ユーザー"}との連携が完了しました`,
      })

      setInputLinkCode("")
    } catch (error) {
      console.error("連携に失敗しました:", error)
      toast({
        title: "エラー",
        description: "連携に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUnlinkAccount() {
    if (!user || !accountToUnlink) return

    setIsSubmitting(true)
    try {
      // 自分の設定から相手のIDを削除
      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      const mySettingsDoc = await getDoc(doc(db, "userSettings", user.uid))

      if (!mySettingsDoc.exists()) {
        toast({
          title: "エラー",
          description: "ユーザー設定が見つかりません",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const mySettings = mySettingsDoc.data()
      const myLinkedAccounts = mySettings.linkedAccounts || []

      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      await updateDoc(doc(db, "userSettings", user.uid), {
        linkedAccounts: myLinkedAccounts.filter((id: string) => id !== accountToUnlink),
        updatedAt: new Date(),
      })

      // 相手の設定から自分のIDを削除
      try {
        if (!db) {
          console.error("Firestore is not initialized")
          setIsSubmitting(false)
          return
        }
        const targetSettingsDoc = await getDoc(doc(db, "userSettings", accountToUnlink))
        if (targetSettingsDoc.exists()) {
          const targetLinkedAccounts = targetSettingsDoc.data().linkedAccounts || []
          if (!db) {
            console.error("Firestore is not initialized")
            setIsSubmitting(false)
            return
          }
          await updateDoc(doc(db, "userSettings", accountToUnlink), {
            linkedAccounts: targetLinkedAccounts.filter((id: string) => id !== user.uid),
            updatedAt: new Date(),
          })
        }
      } catch (error) {
        console.error("相手の連携解除に失敗しました:", error)
      }

      // 連携アカウントリストを更新
      setLinkedAccounts(linkedAccounts.filter((account) => account.uid !== accountToUnlink))

      toast({
        title: "連携を解除しました",
        description: "アカウントとの連携を解除しました",
      })
    } catch (error) {
      console.error("連携解除に失敗しました:", error)
      toast({
        title: "エラー",
        description: "連携解除に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setAccountToUnlink(null)
    }
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled); // Keep local state update for immediate UI feedback

    if (user) { // Ensure user object is available
      try {
        if (!db) { // Ensure db is available
          console.error("Firestore is not initialized");
          toast({ title: "エラー", description: "データベースに接続できません。", variant: "destructive" });
          setNotificationsEnabled(!enabled); // Revert UI on error
          return;
        }
        // Save the preference to Firestore first
        console.log("通知設定をFirestoreに保存します。enabled:", enabled);
        await updateDoc(doc(db, "userSettings", user.uid), {
          notificationsEnabled: enabled, // 後方互換性のため保持
          "notificationSettings.reminderNotifications": enabled,
          updatedAt: new Date(),
        });
        console.log("通知設定をFirestoreに保存しました:", enabled);

        if (enabled) {
          toast({
            title: "通知が有効になりました",
            description: "LINE通知が有効になりました。",
          });
        } else {
          toast({
            title: "通知が無効になりました",
            description: "LINE通知が無効になりました。",
          });
        }
      } catch (error) {
        console.error("通知設定の処理中にエラーが発生しました:", error);
        toast({
          title: "エラー",
          description: `通知設定の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`, // エラーメッセージを表示
          variant: "destructive",
        });
        setNotificationsEnabled(!enabled); // Revert UI on error
      }
    } else {
      console.warn("User object not available in handleNotificationToggle");
      toast({ title: "エラー", description: "ユーザー情報が見つかりません。", variant: "destructive" });
      setNotificationsEnabled(!enabled); // Revert UI
    }
  };

  const handleLowMedicationAlertsToggle = async (enabled: boolean) => {
    setLowMedicationAlertsEnabled(enabled); // Keep local state update for immediate UI feedback

    if (user) { // Ensure user object is available
      try {
        if (!db) { // Ensure db is available
          console.error("Firestore is not initialized");
          toast({ title: "エラー", description: "データベースに接続できません。", variant: "destructive" });
          setLowMedicationAlertsEnabled(!enabled); // Revert UI on error
          return;
        }
        // Save the preference to Firestore first
        console.log("残量通知設定をFirestoreに保存します。enabled:", enabled);
        await updateDoc(doc(db, "userSettings", user.uid), {
          "notificationSettings.lowMedicationAlerts": enabled,
          updatedAt: new Date(),
        });
        console.log("残量通知設定をFirestoreに保存しました:", enabled);

        if (enabled) {
          toast({
            title: "残量通知が有効になりました",
            description: "お薬の残量が少なくなったら通知します。",
          });
        } else {
          toast({
            title: "残量通知が無効になりました",
            description: "お薬の残量通知が無効になりました。",
          });
        }
      } catch (error) {
        console.error("残量通知設定の処理中にエラーが発生しました:", error);
        toast({
          title: "エラー",
          description: `残量通知設定の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        });
        setLowMedicationAlertsEnabled(!enabled); // Revert UI on error
      }
    } else {
      console.warn("User object not available in handleLowMedicationAlertsToggle");
      toast({ title: "エラー", description: "ユーザー情報が見つかりません。", variant: "destructive" });
      setLowMedicationAlertsEnabled(!enabled); // Revert UI
    }
  };

  const copyLinkCode = () => {
    navigator.clipboard.writeText(linkCode)
    toast({
      title: "コピーしました",
      description: "連携コードがクリップボードにコピーされました",
    })
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
        <h1 className="text-3xl font-bold tracking-tight">設定</h1>

        {/* Content sections */}
        <Card>
            <CardHeader>
                <CardTitle>リマインダー時間設定</CardTitle>
                  <CardDescription>各服用タイミングのリマインダー時間を設定します</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...reminderForm}>
                    <form onSubmit={reminderForm.handleSubmit(onReminderSubmit)} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={reminderForm.control}
                            name="朝"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>朝の服用時間</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={reminderForm.control}
                            name="昼"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>昼の服用時間</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={reminderForm.control}
                            name="晩"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>晩の服用時間</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={reminderForm.control}
                            name="就寝前"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>就寝前の服用時間</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={reminderForm.control}
                            name="頓服"
                            render={({ field }) => (
                                <FormItem>
                                  <FormLabel>頓服の服用時間 (任意)</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} />
                                  </FormControl>
                                  <FormDescription>必要な場合のみ設定してください。</FormDescription>
                                  <FormMessage />
                                </FormItem>
                            )}
                        />
                      </div>

                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "保存中..." : "設定を保存"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

          <Card>
                <CardHeader>
                  <CardTitle>通知設定</CardTitle>
                  <CardDescription>アプリからの通知設定を管理します</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        LINE通知
                      </label>
                      <p className="text-sm text-muted-foreground">服薬時間になったらLINEに通知を送信します</p>
                    </div>
                    <Switch checked={notificationsEnabled} onCheckedChange={handleNotificationToggle} />
                  </div>

                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        残量通知
                      </label>
                      <p className="text-sm text-muted-foreground">お薬の残量が少なくなったら通知します</p>
                    </div>
                    <Switch checked={lowMedicationAlertsEnabled} onCheckedChange={handleLowMedicationAlertsToggle} />
                  </div>
                </CardContent>
              </Card>

          <Card>
                <CardHeader>
                  <CardTitle>アカウント設定</CardTitle>
                  <CardDescription>アカウント情報を管理します</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      メールアドレス
                    </label>
                    <Input value={user?.email || ""} readOnly disabled />
                    <p className="text-sm text-muted-foreground">現在のメールアドレスです</p>
                  </div>

                  <Form {...accountForm}>
                    <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                      <FormField
                          control={accountForm.control}
                          name="displayName"
                          render={({ field }) => (
                              <FormItem>
                                <FormLabel>表示名</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormDescription>アプリ内で表示される名前です</FormDescription>
                                <FormMessage />
                              </FormItem>
                          )}
                      />
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "保存中..." : "変更を保存"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

          <Card>
                <CardHeader>
                  <CardTitle>ペアレンタルコントロール</CardTitle>
                  <CardDescription>家族の服薬状況を管理します</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      連携アカウント
                    </label>
                    <div className="rounded-md border p-4">
                      {linkedAccounts.length > 0 ? (
                          <ul className="space-y-2">
                            {linkedAccounts.map((account) => (
                                <li key={account.uid} className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
                                  <span>{account.displayName}</span>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm" onClick={() => setAccountToUnlink(account.uid)}>
                                        <Unlink className="h-4 w-4 mr-1" />
                                        解除
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>連携を解除しますか？</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {account.displayName}との連携を解除します。この操作は元に戻せません。
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setAccountToUnlink(null)}>
                                          キャンセル
                                        </AlertDialogCancel>
                                        <AlertDialogAction onClick={handleUnlinkAccount}>解除する</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </li>
                            ))}
                          </ul>
                      ) : (
                          <p className="text-sm text-muted-foreground">現在連携しているアカウントはありません</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">家族のアカウントと連携して服薬状況を確認できます</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      アカウント連携コード
                    </label>
                    <form onSubmit={handleLinkCodeSubmit} className="space-y-2">
                      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                        <Input
                            placeholder="連携コードを入力"
                            value={inputLinkCode}
                            onChange={(e) => setInputLinkCode(e.target.value)}
                            minLength={5}
                            required
                        />
                        <Button type="submit" disabled={isSubmitting}>
                          連携
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">家族から共有された連携コードを入力してください</p>
                    </form>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      自分の連携コード
                    </label>
                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                      <Input value={linkCode} readOnly />
                      <Button variant="outline" onClick={copyLinkCode}>
                        <Copy className="h-4 w-4 mr-2" />
                        コピー
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">このコードを家族に共有して連携できます</p>
                  </div>
                </CardContent>
              </Card>
          
      </div>
  )
}

