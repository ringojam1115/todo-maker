import { NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/constants/models";
import type { Goal, DailyPlan, DailyFeedback } from "@/types";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  try {
    const {
      goal,
      plans,
      feedbacks,
    }: { goal: Goal; plans: DailyPlan[]; feedbacks: DailyFeedback[] } =
      await request.json();

    const completedTasks = plans
      .flatMap((p) => p.tasks)
      .filter((t) => t.completed)
      .map((t) => `・${t.text}`);

    const allTasks = plans.flatMap((p) => p.tasks).map((t) => `・${t.text}`);

    const feedbackSummary = feedbacks
      .map((f) => {
        const avg = Math.round(
          f.taskFeedbacks.reduce((s, t) => s + t.completionRate, 0) /
            Math.max(1, f.taskFeedbacks.length)
        );
        return `${f.date}: 達成率${avg}%、コンディション${f.energyLevel}`;
      })
      .join("\n");

    const prompt = `
以下はユーザーが「${goal.title}」という学習目標に取り組んだ記録です。
この学習を通じて習得・練習したスキルや知識を、具体的に記述してください。

## 目標の詳細
- タイトル: ${goal.title}
- 期限: ${goal.deadline}
- 現在のレベル（開始時）: ${goal.currentLevel || "未設定"}
- 使用教材: ${goal.materials.map((m) => m.name).join("、") || "なし"}

## 取り組んだタスク（全${allTasks.length}件）
${allTasks.slice(0, 30).join("\n") || "なし"}

## 完了したタスク（${completedTasks.length}件）
${completedTasks.slice(0, 20).join("\n") || "なし"}

## 学習記録
${feedbackSummary || "記録なし"}

## 出力形式
習得・練習したスキルや知識を200〜300字程度でまとめてください。
箇条書きを活用し、具体的に記述してください。
日本語で。
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
      return NextResponse.json(
        { error: errJson?.error?.message ?? `OpenAI error ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const skills: string = data.choices[0].message.content;

    return NextResponse.json({ skills });
  } catch (e) {
    console.error("[extract-skills] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
