import { NextResponse } from "next/server"

export async function GET() {
  // VAPIDキーをサーバーサイドから提供
  return NextResponse.json({
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  })
}

