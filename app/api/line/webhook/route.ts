import { NextRequest, NextResponse } from "next/server";
import { Client, validateSignature, WebhookEvent } from "@line/bot-sdk";
import { handleTextMessage } from "@/lib/line-handler";
import { initScheduler } from "@/lib/scheduler"; // スケジューラーをインポート

// スケジューラーを初期化
initScheduler();

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

const client = new Client(config);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") || "";

  // 署名の検証
  if (!validateSignature(body, config.channelSecret, signature)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const events: WebhookEvent[] = JSON.parse(body).events;

  try {
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        await handleTextMessage(event.source.userId!, event.message.text, event.replyToken);
      }
      // TODO: フォローイベント（友達追加）の処理などを追加
    }
  } catch (error) {
    console.error("LINE Webhook Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
