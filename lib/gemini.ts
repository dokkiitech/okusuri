import { GoogleGenerativeAI } from "@google/generative-ai";
import { Medication } from "./types"; // Medicationインターフェースをインポート

// APIキーを使用して初期化
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function askGemini(question: string, medications?: Medication[]) {
  try {
    // モデル名を最新版に変更！
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    let prompt = `以下の質問について、医薬品の飲み合わせに関する専門的な観点から回答してください。
    出力は**Markdown記法を使わず**、アスタリスク（*）や記号なしで、プレーンな日本語テキストとして書いてください。
    回答は日本語で、簡潔かつ分かりやすく説明してください。
    また、必ず「これは一般的な情報であり、具体的な医療アドバイスではありません。医師や薬剤師に相談することをお勧めします。」という注意書きを含めてください。
    `;

    if (medications && medications.length > 0) {
      const medicationList = medications.map(m => `- ${m.name} (残数: ${m.remainingCount || '不明'})`).join('\n');
      prompt += `\n\nユーザーが現在登録しているお薬情報:\n${medicationList}\n\n`;
    }

    prompt += `質問: ${question}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("回答の生成中にエラーが発生しました。");
  }
}