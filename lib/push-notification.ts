import { getMessaging, getToken, onMessage } from "firebase/messaging"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "./firebase"

// プッシュ通知がサポートされているかチェック
export const isPushNotificationSupported = () => {
  return "serviceWorker" in navigator && "PushManager" in window
}

// 通知許可を要求
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("このブラウザは通知をサポートしていません")
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    return permission === "granted"
  } catch (error) {
    console.error("通知許可の要求に失敗しました:", error)
    return false
  }
}

// サーバーからVAPID Keyを取得
const getVapidKey = async () => {
  try {
    const response = await fetch("/api/firebase-vapid")
    if (!response.ok) {
      throw new Error("VAPID Keyの取得に失敗しました")
    }
    const data = await response.json()
    return data.vapidKey
  } catch (error) {
    console.error("VAPID Keyの取得エラー:", error)
    return null
  }
}

// プッシュ通知を有効化
export const enablePushNotifications = async (userId: string) => {
  if (!isPushNotificationSupported()) {
    console.log("このブラウザはプッシュ通知をサポートしていません")
    return false
  }

  try {
    // サービスワーカーを登録
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

    // サーバーからVAPID Keyを取得
    const vapidKey = await getVapidKey()
    if (!vapidKey) {
      console.error("VAPID Keyの取得に失敗しました")
      return false
    }

    // FCMトークンを取得
    const messaging = getMessaging()
    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!currentToken) {
      console.log("FCMトークンを取得できませんでした")
      return false
    }

    // トークンをFirestoreに保存
    await setDoc(doc(db, "userTokens", userId), {
      token: currentToken,
      platform: "web",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // フォアグラウンドメッセージのハンドラを設定
    onMessage(messaging, (payload) => {
      console.log("フォアグラウンドメッセージを受信しました:", payload)

      // カスタム通知を表示
      if (payload.notification) {
        const { title, body } = payload.notification

        new Notification(title as string, {
          body: body as string,
          icon: "/icon-192x192.png",
        })
      }
    })

    return true
  } catch (error) {
    console.error("プッシュ通知の有効化に失敗しました:", error)
    return false
  }
}

// 通知を表示
export const showNotification = (title: string, body: string) => {
  if (!("Notification" in window)) {
    console.log("このブラウザは通知をサポートしていません")
    return
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/icon-192x192.png",
    })
  }
}

