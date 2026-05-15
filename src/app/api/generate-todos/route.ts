import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { Material } from "@/types";

interface OtherGoal {
  title: string;
  dailyMinutes: number;
  daysLeft: number;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const {
      goalTitle,
      deadline,
      today,
      currentLevel,
      dailyMinutes,
      materials,
      calendarSlots,
      otherGoals,
    }: {
      goalTitle: string;
      deadline: string;
      today: string;
      currentLevel?: string;
      dailyMinutes?: number;
      materials?: Material[];
      calendarSlots?: Record<string, number>;
      otherGoals?: OtherGoal[];
    } = await request.json();

    const deadlineDate = new Date(deadline);
    const todayDate = new Date(today);
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const minsPerDay = dailyMinutes ?? 60;

    const materialsText =
      materials && materials.length > 0
        ? materials
            .map(
              (m) => `
    教材名: ${m.name}
    構成: ${m.structure}
    ${m.totalPages ? `総ページ数: ${m.totalPages}` : ""}
    ${m.features ? `特徴: ${m.features}` : ""}`
            )
            .join("\n")
        : "教材未指定。YouTube・問題サイト等の無料リソースを活用する前提で作成すること。";

    // Build calendar availability section
    const calendarSection =
      calendarSlots && Object.keys(calendarSlots).length > 0
        ? `
## 各日の利用可能な学習時間（Googleカレンダーより）
${Object.entries(calendarSlots)
  .filter(([date]) => date >= today && date <= deadline)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, mins]) => `${date}: ${mins}分`)
  .join("\n")}
（記載のない日は1日${minsPerDay}分を想定）
`
        : "";

    // Build other goals context
    const otherGoalsSection =
      otherGoals && otherGoals.length > 0
        ? `
## 他の学習目標（参考：この目標のプランを立てる際に総負荷を考慮すること）
${otherGoals.map((g) => `- ${g.title}: 残り${g.daysLeft}日、1日${g.dailyMinutes}分`).join("\n")}
合計1日の学習時間目安: ${otherGoals.reduce((s, g) => s + g.dailyMinutes, 0) + minsPerDay}分
`
        : "";

    const prompt = `
あなたは学習計画の専門家です。
以下の情報をもとに、具体的な日別TODOプランを作成してください。

## 目標
タイトル: ${goalTitle}
期限: ${deadline}（残り${daysLeft}日）
現在のレベル: ${currentLevel || "未設定"}
1日の学習時間: ${minsPerDay}分
今日の日付: ${today}

## 使用教材
${materialsText}
${calendarSection}
${otherGoalsSection}

## TODOの書き方ルール（必ず守ること）
- 「何を・どこまで・どのくらいの量」を必ず含める
  ✅ 良い例：「公式問題集Vol.2 Part3 Q41-52を解き、全問解説を読む」
  ❌ 悪い例：「リスニング問題を解く」
- 教材が指定されている場合は必ず教材名・ページ数・問題番号・章名を含める
- 1タスクは${Math.round(minsPerDay / 3)}〜${Math.round(minsPerDay / 2)}分で完了できる粒度にする
- 1日${Math.ceil(minsPerDay / 60)}〜${Math.ceil(minsPerDay / 60) + 1}タスクに絞る（詰め込みすぎない）
- タスクの種類によって毎日こなすべきもの（語彙・リスニング習慣など）とまとまった時間でやるべきもの（過去問演習など）を考慮すること
- 必ずしも毎日同じゴールのタスクを入れる必要はない。他ゴールとのバランスで休憩日を設けても良い
- estimatedMinutesは現実的な数値にする
- カレンダーで空き時間が少ない日はタスク数を減らすこと

## 実現可能性チェック
- 期限内に達成できるか現実的に検討すること
- 達成が困難と思われる場合は最初のタスクの focus に「⚠️ 学習量が多い可能性があります」と記載すること

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
