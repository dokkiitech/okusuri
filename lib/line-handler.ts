import { Client } from "@line/bot-sdk";
import { adminDb } from "@/lib/firebase-admin";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { askGemini } from "@/lib/gemini"; // 既存のGemini AI関数

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};
const client = new Client(config);

// ユーザーの会話状態を管理（インメモリ。本番環境ではDB推奨）
const userAIState: { [userId: string]: boolean } = {};

export async function sendLineMessage(userId: string, message: string) {
  try {
    await client.pushMessage(userId, { type: "text", text: message });
    console.log(`LINEメッセージをユーザー ${userId} に送信しました: ${message}`);
  } catch (error) {
    console.error(`LINEメッセージの送信に失敗しました (ユーザーID: ${userId}):`, error);
  }
}

export async function handleTextMessage(userId: string, text: string, replyToken: string) {
  // 1. アカウント連携コードの処理 (ペアレンタルコントロールと同じものを利用)
  // ここでは、`text` が連携コードとして直接ユーザーIDを指していると仮定します。
  // 実際のペアレンタルコントロールの連携コードの仕組みに合わせて調整が必要です。
  const userDocRef = adminDb.collection('users').doc(text); // 例: usersコレクションにユーザー情報がある場合
  const userDocSnap = await userDocRef.get();

  if (userDocSnap.exists()) {
    // 連携コード（ユーザーID）が見つかった場合
    const lineConnectionRef = adminDb.collection('lineConnections').doc(userId);
    await lineConnectionRef.set({ appUserId: text, linkedAt: new Date() });
    await client.replyMessage(replyToken, {
      type: "text",
      text: "アカウントの連携が完了しました！",
    });
    return;
  }

  // 2. 連携済みユーザーか確認
  const lineConnectionRef = adminDb.collection('lineConnections').doc(userId);
  const lineConnectionSnap = await lineConnectionRef.get();
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

  // AIに質問の後に続けて質問文が送信された場合に限り返答
  if (userAIState[userId] && !text.startsWith("AIに質問")) {
    userAIState[userId] = false; // 一回の質問で状態をリセット
    const aiResponse = await askGemini(text); // 既存のAI関数を呼び出す
    await client.replyMessage(replyToken, {
      type: "text",
      text: aiResponse,
    });
    return;
  }

  // 4. 飲み合わせ確認の処理
  if (text.startsWith("飲み合わせ確認")) {
    const medications = text.replace("飲み合わせ確認", "").trim().split(/[,、\s]+/);
    if (medications.length < 2) {
      await client.replyMessage(replyToken, {
        type: "text",
        text: "飲み合わせ確認ですね。複数のお薬の名前を「、」で区切って入力してください。（例: ロキソニン、カロナール）",
      });
      return;
    }

    // ここに実際の飲み合わせ確認ロジックを実装します。
    // 例: 外部APIへの問い合わせ、データベース検索など。
    // 今回はダミーの応答を返します。
    const interactionResult = `「${medications.join("」と「")}」の飲み合わせを確認しました。\n現時点では、特筆すべき相互作用は見つかりませんでした。\n\n※これはデモンストレーションです。実際の服薬については医師や薬剤師にご相談ください。`;

    await client.replyMessage(replyToken, {
      type: "text",
      text: interactionResult,
    });
    return;
  }

  // デフォルトの返信
  await client.replyMessage(replyToken, {
    type: "text",
    text: "メッセージありがとうございます。現在、個別の返信は行っておりません。",
  });
}
