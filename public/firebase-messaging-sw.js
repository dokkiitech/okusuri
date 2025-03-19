importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js")

// Firebase設定
// 注: 実際の設定はランタイムで取得する必要があります
// このファイルでは最小限の設定のみを使用
const firebaseConfig = {
  // 設定はランタイムで注入されます
}

// 設定が利用可能な場合のみ初期化
if (self.firebaseConfig) {
  const firebaseApp = firebase.initializeApp(self.firebaseConfig)
  const messaging = firebase.messaging()

  // バックグラウンドメッセージハンドラ
  messaging.onBackgroundMessage((payload) => {
    console.log("バックグラウンドメッセージを受信しました:", payload)

    const notificationTitle = payload.notification.title
    const notificationOptions = {
      body: payload.notification.body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data: payload.data,
      vibrate: [200, 100, 200],
    }

    self.registration.showNotification(notificationTitle, notificationOptions)
  })
}

// 通知クリック時のハンドラ
self.addEventListener("notificationclick", (event) => {
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
  self.skipWaiting()
})

// Service Workerのアクティベーション時のハンドラ
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})

