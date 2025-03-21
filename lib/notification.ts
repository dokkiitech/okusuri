// ブラウザ通知の許可を要求
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

// リマインダー通知をスケジュール
export const scheduleNotification = (title: string, body: string, time: Date) => {
  const now = new Date()
  const delay = time.getTime() - now.getTime()

  if (delay <= 0) return

  setTimeout(() => {
    showNotification(title, body)
  }, delay)
}

