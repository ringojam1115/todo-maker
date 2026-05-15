import { NextResponse } from "next/server";
import type { Goal, DailyPlan, DailyFeedback } from "@/types";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const {
      goal,
      plans,
      feedbacks,
      llm,
    }: { goal: Goal; plans: DailyPlan[]; feedbacks: DailyFeedback[]; llm?: LLMRequestSettings } =
      await request.json();

    const completedFeedbackTasks = feedbacks.flatMap((feedback) =>
      feedback.taskFeedbacks
        .filter((task) => task.completed && task.completionRate > 0)
        .map((task) => ({
          date: feedback.date,
          text: task.taskText,
          completionRate: task.completionRate,
          actualMinutes: task.actualMinutes,
          difficulty: task.difficulty,
          reflection: task.reflection,
          artifact: task.artifact,
        }))
    );

    if (completedFeedbackTasks.length === 0) {
      return NextResponse.json({ skills: "" });
    }

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

## フィードバック付きの完了タスク（${completedFeedbackTasks.length}件）
${completedFeedbackTasks
  .slice(0, 30)
  .map(
    (task) => `・${task.date}: ${task.text}
  達成度: ${task.completionRate}%
  実績時間: ${task.actualMinutes}分
  難易度: ${task.difficulty}
  メモ: ${task.reflection || "なし"}
  成果物: ${task.artifact || "なし"}`
  )
  .join("\n")}

## 学習記録
${feedbackSummary || "記録なし"}

## 出力形式
完了タスクとフィードバックから読み取れる範囲だけで、習得・練習したスキルや知識を200〜300字程度でまとめてください。
未完了のこと、未確認の成果、達成していない能力を達成済みのように書かないでください。
箇条書きを活用し、具体的に記述してください。
日本語で。
${languageInstruction(llm?.language)}
`.trim();

    const skills = await callTextLLM(prompt, llm);

    return NextResponse.json({ skills });
  } catch (e) {
    console.error("[extract-skills] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
