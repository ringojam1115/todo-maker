import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { Material } from "@/types";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const { goalTitle, deadline, today, currentLevel, dailyMinutes, materials } =
      await request.json();

    const deadlineDate = new Date(deadline);
    const todayDate = new Date(today);
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const materialsText =
      materials && materials.length > 0
        ? materials
            .map(
              (m: Material) => `
    教材名: ${m.name}
    構成: ${m.structure}
    ${m.totalPages ? `総ページ数: ${m.totalPages}` : ""}
    ${m.features ? `特徴: ${m.features}` : ""}`
            )
            .join("\n")
        : "教材未指定。YouTube・問題サイト等の無料リソースを活用する前提で作成すること。";

    const prompt = `
あなたは学習計画の専門家です。
以下の情報をもとに、具体的な日別TODOプランを作成してください。

## 目標
タイトル: ${goalTitle}
期限: ${deadline}（残り${daysLeft}日）
現在のレベル: ${currentLevel || "未設定"}
1日の学習時間: ${dailyMinutes || 60}分
今日の日付: ${today}

## 使用教材
${materialsText}

## TODOの書き方ルール（必ず守ること）
- 「何を・どこまで・どのくらいの量」を必ず含める
  ✅ 良い例：「公式問題集Vol.2 Part3 Q41-52を解き、全問解説を読む」
  ❌ 悪い例：「リスニング問題を解く」
- 教材が指定されている場合は必ず教材名・ページ数・問題番号・章名を含める
- 教材が未指定の場合は「何をどれだけやるか」を数値で明記する
- 1タスクは${Math.round((dailyMinutes || 60) / 3)}〜${Math.round((dailyMinutes || 60) / 2)}分で完了できる粒度にする
- 1日${Math.ceil((dailyMinutes || 60) / 60)}〜${Math.ceil((dailyMinutes || 60) / 60) + 1}タスクに絞る（詰め込みすぎない）
- estimatedMinutesは現実的な数値にする

## 出力形式（JSONのみ・マークダウン不要）
[
  {
    "date": "YYYY-MM-DD",
    "focus": "その日のメインテーマ",
    "tasks": [
      {
        "id": "一意なuuid",
        "text": "具体的なタスクの説明",
        "estimatedMinutes": 45
      }
    ]
  }
]
`.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.MAIN,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const message = errJson?.error?.message ?? `OpenAI error ${res.status}`;
      console.error("[generate-todos] OpenAI error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.choices[0].message.content;

    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const plan = JSON.parse(cleaned);
    return NextResponse.json(plan);
  } catch (e) {
    console.error("[generate-todos] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
