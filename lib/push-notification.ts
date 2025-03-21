import { getMessaging, getToken, onMessage } from "firebase/messaging"
import { setDoc, doc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

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
    console.log("通知許可状態:", permission)
    return permission === "granted"
  } catch (error) {
    console.error("通知許可の要求に失敗しました:", error)
    return false
  }
}

// プッシュ通知を有効化
export const enablePushNotifications = async (userId: string) => {
  if (!isPushNotificationSupported()) {
    console.log("このブラウザはプッシュ通知をサポートしていません")
    return false
  }

  try {
    console.log("プッシュ通知の有効化を開始...")

    // サービスワーカーを登録
    console.log("Service Workerを登録中...")
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    })
    console.log("Service Worker登録成功:", registration)

    // Firebase設定をService Workerに送信
    console.log("Firebase設定をService Workerに送信中...")
    await sendFirebaseConfigToServiceWorker()

    // FCMトークンを取得
    console.log("FCMトークンを取得中...")
    const messaging = getMessaging()

    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      console.error("VAPID Keyが設定されていません")
      return false
    }

    console.log("VAPID Key:", process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.substring(0, 5) + "...")

    const currentToken = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!currentToken) {
      console.log("FCMトークンを取得できませんでした")
      return false
    }

    console.log("FCMトークン取得成功:", currentToken.substring(0, 10) + "...")

    // トークンをFirestoreに保存
    if (!db) {
      console.error("Firestore is not initialized")
      return false
    }

    console.log("トークンをFirestoreに保存中...")
    await setDoc(doc(db, "userTokens", userId), {
      token: currentToken,
      platform: "web",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log("トークンの保存成功")

    // フォアグラウンドメッセージのハンドラを設定
    onMessage(messaging, (payload) => {
      console.log("フォアグラウンドメッセージを受信しました:", payload)

      // カスタム通知を表示
      if (payload.notification) {
        const { title, body } = payload.notification

        new Notification(title as string, {
          body: body as string,
          icon: "/icon.svg",
        })
      }
    })

    console.log("プッシュ通知の有効化が完了しました")
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
      icon: "/icon.svg",
    })
  }
}

// リマインダー通知をスケジュール
export const scheduleNotification = (title: string, body: string, time: Date) => {
  const now = new Date()
  const delay = time.getTime() - now.getTime()

  if (delay <= 0) return

  setTimeout(() => {
    showNotification(title, body)
  }, delay)
}

// Service Workerに Firebase 設定を送信
export const sendFirebaseConfigToServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return

  try {
    console.log("Service Workerの準備を待機中...")
    const registration = await navigator.serviceWorker.ready
    console.log("Service Worker準備完了")

    // Firebase設定を取得
    console.log("Firebase設定をAPIから取得中...")
    const response = await fetch("/api/firebase-config")
    const firebaseConfig = await response.json()
    console.log("Firebase設定取得成功")

    // Service Workerに設定を送信
    console.log("Service Workerに設定を送信中...")
    registration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config: firebaseConfig,
    })
    console.log("Service Workerへの設定送信完了")
  } catch (error) {
    console.error("Service Workerへの設定送信に失敗:", error)
  }
}

// 通知をテスト送信
export const sendTestNotification = () => {
  console.log("テスト通知を送信中...")
  showNotification("テスト通知", "これはテスト通知です。この通知が表示されれば、通知機能は正常に動作しています。")
  return true
}

