import { Client } from "@line/bot-sdk";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { askAI } from "@/lib/gemini"; // 既存のGemini AI関数

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};
const client = new Client(config);

// ユーザーの会話状態を管理（インメモリ。本番環境ではDB推奨）
const userAIState: { [userId: string]: boolean } = {};

export async function handleTextMessage(userId: string, text: string, replyToken: string) {
  // 1. アカウント連携コードの処理
  const userSettingsRef = doc(db, "userSettings", text); // textが連携コードだと仮定
  const userSettingsSnap = await getDoc(userSettingsRef);

  if (userSettingsSnap.exists()) {
    // 連携コードが見つかった場合
    const lineConnectionRef = doc(db, "lineConnections", userId);
    await setDoc(lineConnectioneRef, { appUserId: text, linkedAt: new Date() });
    await client.replyMessage(replyToken, {
      type: "text",
      text: "アカウントの連携が完了しました！",
    });
    return;
  }

  // 2. 連携済みユーザーか確認
  const lineConnectionRef = doc(db, "lineConnections", userId);
  const lineConnectionSnap = await getDoc(lineConnectionRef);
  if (!lineConnectionSnap.exists()) {
    await client.replyMessage(replyToken, {
      type: "text",
      text: "アカウントが連携されていません。アプリの設定画面から連携コードを送信してください。",
    });
    return;
  }
  const { appUserId } = lineConnectionSnap.data();

  // 3. AIへの質問の処理
  if (text.startsWith("AIに質問")) {
    userAIState[userId] = true;
    await client.replyMessage(replyToken, {
      type: "text",
      text: "AIへの質問ですね。続けて質問内容をどうぞ。",
    });
    return;
  }

  if (userAIState[userId]) {
    // AIへの質問の継続
    userAIState[userId] = false; // 一回の質問で状態をリセット
    const aiResponse = await askAI(text); // 既存のAI関数を呼び出す
    await client.replyMessage(replyToken, {
      type: "text",
      text: aiResponse,
    });
    return;
  }

  // 4. 飲み合わせ確認の処理
  if (text.startsWith("飲み合わせ確認")) {
    // TODO: 飲み合わせ確認のロジックを実装
    await client.replyMessage(replyToken, {
      type: "text",
      text: "飲み合わせ確認ですね。お薬の名前を「、」で区切って入力してください。（例: ロキソニン、カロナール）",
    });
    return;
  }

  // デフォルトの返信
  await client.replyMessage(replyToken, {
    type: "text",
    text: "メッセージありがとうございます。現在、個別の返信は行っておりません。",
  });
}
