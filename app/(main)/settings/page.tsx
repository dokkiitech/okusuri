"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import type { UserSettings } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { generateLinkCode } from "@/lib/utils"
import { Copy, Unlink } from "lucide-react"
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
import { requestNotificationPermission } from "@/lib/notification"
import { enablePushNotifications, isPushNotificationSupported } from "@/lib/push-notification"

const reminderFormSchema = z.object({
  朝: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  昼: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  晩: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
  就寝前: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "時間は HH:MM 形式で入力してください"),
})

const accountFormSchema = z.object({
  displayName: z.string().min(2, "名前は2文字以上である必要があります"),
})

interface LinkedAccount {
  uid: string
  displayName: string
}

// v0環境かどうかをチェック
const isV0Environment =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("vusercontent.net") || window.location.hostname.includes("localhost"))

export default function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [linkCode, setLinkCode] = useState("")
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [inputLinkCode, setInputLinkCode] = useState("")
  const [accountToUnlink, setAccountToUnlink] = useState<string | null>(null)
  const [isPwaSupported, setIsPwaSupported] = useState(!isV0Environment)
  const [activeTab, setActiveTab] = useState("reminders")

  const reminderForm = useForm<z.infer<typeof reminderFormSchema>>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      朝: "08:00",
      昼: "12:00",
      晩: "18:00",
      就寝前: "22:00",
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
          const settings = settingsDoc.data() as UserSettings
          reminderForm.reset({
            朝: settings.reminderTimes.朝,
            昼: settings.reminderTimes.昼,
            晩: settings.reminderTimes.晩,
            就寝前: settings.reminderTimes.就寝前,
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

          setNotificationsEnabled(settings.notificationsEnabled || false)
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
            },
            linkCode: newLinkCode,
            linkedAccounts: [],
            notificationsEnabled: false,
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
      await updateDoc(doc(db, "userSettings", user.uid), {
        reminderTimes: values,
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
      const mySettings = mySettingsDoc.data() as UserSettings

      if (mySettings.linkedAccounts && mySettings.linkedAccounts.includes(targetUserId)) {
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
      const myLinkedAccounts = mySettings.linkedAccounts || []
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
      const mySettings = mySettingsDoc.data() as UserSettings
      const myLinkedAccounts = mySettings.linkedAccounts || []

      if (!db) {
        console.error("Firestore is not initialized")
        setIsSubmitting(false)
        return
      }
      await updateDoc(doc(db, "userSettings", user.uid), {
        linkedAccounts: myLinkedAccounts.filter((id) => id !== accountToUnlink),
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
            linkedAccounts: targetLinkedAccounts.filter((id) => id !== user.uid),
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
    setNotificationsEnabled(enabled)

    if (enabled) {
      // v0環境では通知機能をスキップ
      if (isV0Environment) {
        toast({
          title: "プレビュー環境では利用できません",
          description: "通知機能は実際のデプロイ環境でのみ動作します",
        })

        // ユーザー設定に通知設定を保存
        if (user) {
          try {
            if (!db) {
              console.error("Firestore is not initialized")
              return
            }
            await updateDoc(doc(db, "userSettings", user.uid), {
              notificationsEnabled: true,
              updatedAt: new Date(),
            })
          } catch (error) {
            console.error("通知設定の保存に失敗しました:", error)
          }
        }
        return
      }

      // ブラウザの通知許可を要求
      const permissionGranted = await requestNotificationPermission()

      if (!permissionGranted) {
        toast({
          title: "通知が許可されていません",
          description: "ブラウザの設定から通知を許可してください",
          variant: "destructive",
        })
        setNotificationsEnabled(false)
        return
      }

      // プッシュ通知を有効化
      if (isPushNotificationSupported() && user) {
        const pushEnabled = await enablePushNotifications(user.uid)
        if (!pushEnabled) {
          toast({
            title: "プッシュ通知の設定に失敗しました",
            description: "ブラウザの設定を確認してください",
            variant: "destructive",
          })
        }
      }

      // ユーザー設定に通知設定を保存
      if (user) {
        try {
          if (!db) {
            console.error("Firestore is not initialized")
            return
          }
          await updateDoc(doc(db, "userSettings", user.uid), {
            notificationsEnabled: true,
            updatedAt: new Date(),
          })
        } catch (error) {
          console.error("通知設定の保存に失敗しました:", error)
        }
      }
    } else {
      // 通知を無効化
      if (user) {
        try {
          if (!db) {
            console.error("Firestore is not initialized")
            return
          }
          await updateDoc(doc(db, "userSettings", user.uid), {
            notificationsEnabled: false,
            updatedAt: new Date(),
          })
        } catch (error) {
          console.error("通知設定の保存に失敗しました:", error)
        }
      }
    }

    toast({
      title: "通知設定を更新しました",
      description: enabled ? "通知が有効になりました" : "通知が無効になりました",
    })
  }

  const copyLinkCode = () => {
    navigator.clipboard.writeText(linkCode)
    toast({
      title: "コピーしました",
      description: "連携コードがクリップボードにコピーされました",
    })
  }

  // タブ切り替え時のハンドラー
  const handleTabChange = (value: string) => {
    setActiveTab(value)
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

      <Tabs defaultValue="reminders" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="reminders">リマインダー設定</TabsTrigger>
          <TabsTrigger value="notifications">通知設定</TabsTrigger>
          <TabsTrigger value="account">アカウント設定</TabsTrigger>
          <TabsTrigger value="parental">ペアレンタルコントロール</TabsTrigger>
        </TabsList>

        {activeTab === "reminders" && (
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
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "保存中..." : "設定を保存"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>通知設定</CardTitle>
              <CardDescription>アプリからの通知設定を管理します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    ブラウザ通知
                  </label>
                  <p className="text-sm text-muted-foreground">服薬時間になったらブラウザ通知を表示します</p>
                  {isV0Environment && (
                    <p className="text-xs text-amber-600">
                      ※プレビュー環境では通知機能は利用できません。実際のデプロイ環境でのみ動作します。
                    </p>
                  )}
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
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "account" && (
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
        )}

        {activeTab === "parental" && (
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
                        <li key={account.uid} className="flex justify-between items-center">
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
                  <div className="flex space-x-2">
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
                <div className="flex space-x-2">
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
        )}
      </Tabs>
    </div>
  )
}

