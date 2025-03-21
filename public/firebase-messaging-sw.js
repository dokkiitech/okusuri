importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js")

// デバッグ用のログ
console.log("Firebase Messaging Service Worker 読み込み完了")

// Firebase変数を初期化
let firebase

// Firebase設定
// Service Workerでは環境変数にアクセスできないため、
// 初期化時に必要な情報を渡す必要があります
self.addEventListener("message", (event) => {
  console.log("Service Worker: メッセージを受信しました", event.data?.type)

  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    const firebaseConfig = event.data.config
    console.log("Service Worker: Firebase設定を受信しました")

    try {
      // Firebaseを初期化
      firebase = firebase || firebase.initializeApp(firebaseConfig)
      const messaging = firebase.messaging()
      console.log("Service Worker: Firebase Messagingを初期化しました")

      // バックグラウンドメッセージハンドラ
      messaging.onBackgroundMessage((payload) => {
        console.log("Service Worker: バックグラウンドメッセージを受信しました:", payload)

        const notificationTitle = payload.notification?.title || "新しい通知"
        const notificationOptions = {
          body: payload.notification?.body || "新しいメッセージがあります",
          icon: "/icon.svg",
          badge: "/icon.svg",
          data: payload.data,
          vibrate: [200, 100, 200],
        }

        console.log("Service Worker: 通知を表示します", notificationTitle)
        return self.registration.showNotification(notificationTitle, notificationOptions)
      })
    } catch (error) {
      console.error("Service Worker: Firebase初期化エラー", error)
    }
  }
})

// 通知クリック時のハンドラ
self.addEventListener("notificationclick", (event) => {
  console.log("Service Worker: 通知がクリックされました")
  event.notification.close()

  // 通知がクリックされたときに開くURL
  const urlToOpen = new URL("/", self.location.origin).href

  event.waitUntil(
      clients
          .matchAll({
            type: "window",
            includeUncontrolled: true,
          })
          .then((windowClients) => {
            // 既に開いているウィンドウがあればそれをフォーカス
            for (let i = 0; i < windowClients.length; i++) {
              const client = windowClients[i]
              if (client.url === urlToOpen && "focus" in client) {
                return client.focus()
              }
            }
            // なければ新しいウィンドウを開く
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen)
            }
          }),
  )
})

// インストール時のハンドラ
self.addEventListener("install", (event) => {
  console.log("Service Worker: インストールされました")
  self.skipWaiting()
})

// Service Workerのアクティベーション時のハンドラ
self.addEventListener("activate", (event) => {
  console.log("Service Worker: アクティベートされました")
  event.waitUntil(clients.claim())
})

