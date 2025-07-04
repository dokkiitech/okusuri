import { Client } from "@line/bot-sdk";
import { adminDb } from "@/lib/firebase-admin";
import { askGemini } from "@/lib/gemini"; // 既存のGemini AI関数
import { Medication } from "@/lib/types"; // Medicationインターフェースをインポート

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
  console.log(`[LINE Handler] Received message from userId: ${userId}, text: ${text}`);

  // 1. アカウント連携コードの処理 (ペアレンタルコントロールと同じものを利用)
  // `text` が連携コードとして送信される。
  // `userSettings` コレクションの `linkCode` フィールドを検索する。
  const userSettingsSnapshot = await adminDb.collection('userSettings').where('linkCode', '==', text).limit(1).get();

  if (!userSettingsSnapshot.empty) {
    const userSettingDoc = userSettingsSnapshot.docs[0];
    const appUserId = userSettingDoc.id; // userSettingsのドキュメントIDがappUserId

    // 連携コード（ユーザーID）が見つかった場合
    const lineConnectionRef = adminDb.collection('lineConnections').doc(userId);
    await lineConnectionRef.set({ appUserId: appUserId, linkedAt: new Date() });
    await client.replyMessage(replyToken, {
      type: "flex",
      altText: "アカウント連携完了",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "アカウント連携完了",
              weight: "bold",
              size: "md",
              color: "#1DB446",
            },
            {
              type: "text",
              text: "アカウントの連携が完了しました！",
              wrap: true,
              margin: "md",
            },
          ],
        },
      },
    });
    return;
  }

  // 2. 連携済みユーザーか確認
  const lineConnectionRef = adminDb.collection('lineConnections').doc(userId);
  const lineConnectionSnap = await lineConnectionRef.get();
  console.log(`[LINE Handler] lineConnectionSnap.exists for userId (${userId}): ${lineConnectionSnap.exists}`);

  let appUserId: string | undefined;
  if (lineConnectionSnap.exists) {
    appUserId = lineConnectionSnap.data()?.appUserId;
  }

  if (!appUserId) {
    await client.replyMessage(replyToken, {
      type: "flex",
      altText: "アカウント未連携",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "アカウント未連携",
              weight: "bold",
              size: "md",
              color: "#FF0000",
            },
            {
              type: "text",
              text: "アカウントが連携されていません。アプリの設定画面から連携コードコピーし、トーク画面に送信してください。",
              wrap: true,
              margin: "md",
            },
          ],
        },
      },
    });
    return;
  }

  // ユーザーの登録済みお薬情報を取得
  let userMedications: Medication[] = [];
  try {
    const medicationsSnapshot = await adminDb.collection("medications").where("userId", "==", appUserId).get();
    userMedications = medicationsSnapshot.docs.map(doc => doc.data() as Medication);
    console.log(`[LINE Handler] Fetched ${userMedications.length} medications for appUserId: ${appUserId}`);
  } catch (error) {
    console.error(`[LINE Handler] Error fetching medications for appUserId ${appUserId}:`, error);
  }

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
    const aiResponse = await askGemini(text, userMedications); // 既存のAI関数を呼び出す
    await client.replyMessage(replyToken, {
      type: "text",
      text: aiResponse,
    });
    return;
  }

  // 5. ヘルプコマンドの処理
  if (text === "ヘルプ") {
    let statusText = "";
    if (appUserId) {
      statusText = "現在、アカウントは連携済みです。";
    } else {
      statusText = "現在、アカウントは未連携です。連携コードを送信して連携してください。";
    }

    const flexMessage = {
      type: "flex",
      altText: "ヘルプメッセージ",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "ご利用可能なコマンド一覧",
              weight: "bold",
              size: "md",
              margin: "md",
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "text",
              text: statusText,
              wrap: true,
              margin: "md",
              color: appUserId ? "#1DB446" : "#FF0000", // 緑か赤で表示
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "1. アカウント連携",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: "アプリの設定画面で表示される連携コードを送信してください。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "2. AIに質問",
                  weight: "bold",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "まず「AIに質問」と送信し、続けて質問内容を送信してください。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "3. 連携解除",
                  weight: "bold",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "アカウント連携を解除します。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
              ],
            },
          ],
        },
      },
    };

    await client.replyMessage(replyToken, flexMessage);
    return;
  }

  // 4. 連携解除の処理
  if (text === "連携解除") {
    const lineConnectionRef = adminDb.collection('lineConnections').doc(userId);
    await lineConnectionRef.delete();
    await client.replyMessage(replyToken, {
      type: "flex",
      altText: "連携解除完了",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "連携解除完了",
              weight: "bold",
              size: "md",
              color: "#1DB446",
            },
            {
              type: "text",
              text: "アカウントの連携を解除しました。",
              wrap: true,
              margin: "md",
            },
          ],
        },
      },
    });
    return;
  }

  // デフォルトの返信
  await client.replyMessage(replyToken, {
    type: "text",
    text: "メッセージありがとうございます。現在、個別の返信は行っておりません。",
  });
}
