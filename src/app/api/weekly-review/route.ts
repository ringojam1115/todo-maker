import { NextResponse } from "next/server";
import type { LLMRequestSettings } from "@/lib/llm";
import { callTextLLM, languageInstruction, parseJsonText } from "@/lib/llm";
import type { Observation } from "@/types";

interface TaskFeedbackInput {
  taskText: string
  completed: boolean
  difficulty: string
  reflection?: string
}

interface DailyFeedbackInput {
  date: string
  goalId: string
  taskFeedbacks: TaskFeedbackInput[]
  overallNote: string
  energyLevel: string
}

interface GoalInput {
  id: string
  title: string
  current_state?: string
  ideal_state?: string
  gap_summary?: string
  deadline: string
}

export async function POST(request: Request) {
  try {
    const {
      goals,
      feedbacks,
      observations,
      weekStart,
      weekEnd,
      llm,
    }: {
      goals: GoalInput[]
      feedbacks: DailyFeedbackInput[]
      observations: Observation[]
      weekStart: string
      weekEnd: string
      llm?: LLMRequestSettings
    } = await request.json();

    const goalsText = goals
      .map(
        (g) =>
          `目標: ${g.title}
  現状: ${g.current_state || "未設定"}
  理想: ${g.ideal_state || "未設定"}
  ギャップ: ${g.gap_summary || "未設定"}
  期限: ${g.deadline}`
      )
      .join("\n\n");

    const feedbacksText = feedbacks.length > 0
      ? feedbacks
          .map(
            (f) =>
              `[${f.date}] エネルギー: ${f.energyLevel}\n${f.taskFeedbacks
                .map(
                  (t) =>
                    `  - ${t.taskText} (${t.completed ? "完了" : "未完了"}, 難易度: ${t.difficulty})${t.reflection ? ` → ${t.reflection}` : ""}`
                )
                .join("\n")}${f.overallNote ? `\n  メモ: ${f.overallNote}` : ""}`
          )
          .join("\n\n")
      : "今週の記録なし";

    const observationsText = observations.length > 0
      ? observations.map((o) => `- [${o.type}] ${o.content} (確信度: ${Math.round(o.confidence * 100)}%)`).join("\n")
      : "観測なし";

    const prompt = `
あなたは週次レビューを生成するアシスタントです。
${languageInstruction(llm?.language)}

## 重要ルール
- 「あなたは○○です」のような人格固定は禁止
- 「今週○○の傾向がありました」「最近○○が観測されています」のように観測・仮説として表現する
- 断定ではなく、ユーザーが自己理解を深めるための鏡として機能する
- 来週の提案は押しつけではなく軽い提案として書く

## レビュー期間
${weekStart} 〜 ${weekEnd}

## 目標・現状・理想・ギャップ
${goalsText}

## 今週の実績（フィードバックログ）
${feedbacksText}

## 現在の観測
${observationsText}

## 出力形式（JSONのみ）
{
  "progressed": ["今週進んだこと（観測・事実として）"],
  "struggled": ["今週詰まったこと（断定せず傾向として）"],
  "changed_observations": ["変化した観測（あれば）"],
  "gap_diff": "理想との差分（現在の状況を客観的に）",
  "next_week_policy": "来週の方針（軽い提案として）",
  "reduce_todos": ["削るべきTODOの傾向・種類"],
  "increase_todos": ["増やすべきTODOの傾向・種類"]
}
`.trim();

    const text = await callTextLLM(prompt, llm);
    const review = parseJsonText(text);
    return NextResponse.json(review);
  } catch (e) {
    console.error("[weekly-review] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
