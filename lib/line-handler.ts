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
              text: "💊 使い方 💊",
              weight: "bold",
              size: "xl",
              align: "center",
              color: "#1DB446",
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "text",
              text: statusText,
              wrap: true,
              margin: "md",
              color: appUserId ? "#1DB446" : "#FF0000",
              align: "center",
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "✨ LINEでできること",
                  weight: "bold",
                  size: "md",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "・服薬リマインダー通知: 設定した時間にLINEで通知を受け取れます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "・AIによる服薬相談: お薬に関する疑問をAIに質問できます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "・アカウント連携/解除: アプリとLINEアカウントを連携・解除できます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
              ],
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "💡 コマンド一覧",
                  weight: "bold",
                  size: "md",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "1. 「ヘルプ」: このメッセージを表示します。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "2. 「AIに質問」: AIとの会話モードを開始します。続けて質問内容を送信してください。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "3. 「連携解除」: アプリとのアカウント連携を解除します。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "4. [連携コード]: アプリの設定画面で表示される連携コードを送信すると、アカウントが連携されます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
              ],
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "❓ トラブルシューティング",
                  weight: "bold",
                  size: "md",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "・通知が来ない: アプリで通知設定がオンになっているか、LINEアプリの通知設定を確認してください。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "・AIの返答がおかしい: 質問の仕方を具体的に変えてみてください。複雑な質問は複数に分けて質問すると良い場合があります。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "・アカウント連携ができない: 連携コードが正しいか、アプリ側で既に他のLINEアカウントと連携されていないか確認してください。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
              ],
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "text",
                  text: "✨ 実用的な使い方",
                  weight: "bold",
                  size: "md",
                  margin: "md",
                },
                {
                  type: "text",
                  text: "・リマインダー設定: アプリで服薬時間を細かく設定し、LINE通知を有効にすると飲み忘れを防げます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
                {
                  type: "text",
                  text: "・AIへの質問例: 「〇〇という薬の副作用は？」「食後に飲む薬を飲み忘れたらどうすればいい？」など、具体的な質問をするとより的確な回答が得られます。",
                  wrap: true,
                  size: "sm",
                  color: "#666666",
                },
              ],
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "text",
              text: "ご不明な点があれば、再度「ヘルプ」と送信してください。",
              wrap: true,
              size: "sm",
              align: "center",
              color: "#999999",
              margin: "md",
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
