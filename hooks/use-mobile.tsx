"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // 初期チェック
    checkIfMobile()

    // リサイズイベントのリスナーを追加
    window.addEventListener("resize", checkIfMobile)

    // クリーンアップ
    return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  return isMobile
}

